import type { R2Object, DurableObjectStub } from '@cloudflare/workers-types'
import type { FileEnvironment } from './saved-files'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  inspectProjectSnapshot,
  maxProjectSnapshotBytes,
  type ProjectSnapshotRecord,
} from '../core/execution-project-snapshot'
import {
  executionSnapshotUploadSchema,
  type ExecutionIdentity,
} from '../core/execution-sessions'
import type { Conversation } from './conversation'
import { ExecutionSessionError } from './execution-sessions'

type CoordinatorMethods =
  | 'reserveExecutionSnapshot'
  | 'publishExecutionSnapshot'
  | 'executionProjectSnapshot'
type Coordinator =
  | Pick<Conversation, CoordinatorMethods>
  | Pick<DurableObjectStub<Conversation>, CoordinatorMethods>
const metadataHeader = 'x-gum-execution-snapshot'
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
const hex = (value: ArrayBuffer) => Buffer.from(value).toString('hex')

export function executionSnapshotObjectKey(
  identity: ExecutionIdentity,
  snapshotId: string,
) {
  // Object IDs are only unique inside a conversation's ledger. The opaque
  // scope prefix also prevents another user's chosen UUID from colliding.
  const scope = createHash('sha256')
    .update(
      JSON.stringify([
        identity.userId,
        identity.workspaceId,
        identity.botId,
        identity.conversationId,
      ]),
    )
    .digest('hex')
  return `execution-project-snapshots/${scope}/${snapshotId}`
}

/** Allocate one bounded payload buffer, not chunks plus a second full copy. */
export async function readProjectSnapshotBody(
  body: ReadableStream<Uint8Array> | null,
  byteLength: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (
    !Number.isSafeInteger(byteLength) ||
    byteLength < 1 ||
    byteLength > maxProjectSnapshotBytes
  )
    throw new ExecutionSessionError(
      'Project snapshots must be 32 MiB or smaller.',
      413,
    )
  if (!body)
    throw new ExecutionSessionError(
      'The project snapshot body is missing.',
      400,
    )
  const reader = body.getReader()
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      if (part.value.byteLength > bytes.byteLength - offset)
        throw new ExecutionSessionError(
          'The project snapshot byte length does not match.',
          400,
        )
      bytes.set(part.value, offset)
      offset += part.value.byteLength
    }
    if (offset !== byteLength)
      throw new ExecutionSessionError(
        'The project snapshot byte length does not match.',
        400,
      )
    return bytes
  } catch (error) {
    await reader.cancel().catch(() => {})
    if (error instanceof ExecutionSessionError) throw error
    throw new ExecutionSessionError(
      'The snapshot transfer was interrupted. Retry the same snapshot.',
      503,
    )
  } finally {
    reader.releaseLock()
  }
}

function verifyObject(
  object: Pick<R2Object, 'size' | 'checksums'> | null,
  saved: ProjectSnapshotRecord,
) {
  if (
    !object ||
    object.size !== saved.byteLength ||
    !object.checksums.sha256 ||
    hex(object.checksums.sha256) !== saved.sha256
  )
    throw new ExecutionSessionError(
      'The stored project snapshot could not be verified.',
      503,
    )
}
async function verifyBytes(
  bytes: Uint8Array,
  saved: Pick<
    ProjectSnapshotRecord,
    'format' | 'workspaceVersion' | 'byteLength' | 'sha256' | 'fileCount'
  >,
) {
  let actual: Awaited<ReturnType<typeof inspectProjectSnapshot>>
  try {
    actual = await inspectProjectSnapshot(bytes)
  } catch {
    throw new ExecutionSessionError(
      'The project snapshot is invalid or unsupported.',
      400,
    )
  }
  if (
    Object.entries(actual).some(
      ([key, value]) => value !== saved[key as keyof typeof saved],
    )
  )
    throw new ExecutionSessionError(
      'The project snapshot contents do not match their metadata.',
      409,
    )
}

/** R2 work happens between two authorized DO transactions. Interrupted writes
 * retain their pending quota reservation; only an exact retry can finish them.
 * Neither this endpoint nor its R2 keys are transferable restore capabilities. */
export async function executionProjectSnapshotApi(
  request: Request,
  env: Pick<FileEnvironment, 'FILES'>,
  identity: ExecutionIdentity,
  coordinator: Coordinator,
  snapshotId: string,
): Promise<Response> {
  if (!z.uuid().safeParse(snapshotId).success)
    throw new ExecutionSessionError('Project snapshot not found.', 404)
  const query = new URL(request.url).searchParams
  query.delete('workspaceId')
  if (request.method === 'GET') {
    if (
      query.size &&
      (query.size !== 1 ||
        query.getAll('metadata').length !== 1 ||
        query.get('metadata') !== '1')
    )
      throw new ExecutionSessionError('Invalid project snapshot request.', 400)
    const result = await coordinator.executionProjectSnapshot(
      identity,
      snapshotId,
    )
    if (!result.ok) return json({ error: result.error }, result.status)
    const saved = result.snapshot
    if (query.size) return json(saved)
    if (saved.state !== 'ready')
      throw new ExecutionSessionError(
        'This project snapshot is not ready to download.',
        409,
      )
    const object = await env.FILES.get(
      executionSnapshotObjectKey(identity, snapshotId),
    ).catch(() => {
      throw new ExecutionSessionError(
        'The project snapshot could not be loaded. Try again.',
        503,
      )
    })
    try {
      // Recheck after R2 before consuming bytes, and again after their bounded
      // integrity check. Revoked readers do not receive a buffered response.
      const authorized = await coordinator.executionProjectSnapshot(
        identity,
        snapshotId,
      )
      if (!authorized.ok) {
        await object?.body.cancel().catch(() => {})
        return json({ error: authorized.error }, authorized.status)
      }
      verifyObject(object, saved)
      let bytes: Uint8Array<ArrayBuffer>
      try {
        bytes = await readProjectSnapshotBody(object!.body, saved.byteLength)
        await verifyBytes(bytes, saved)
      } catch {
        throw new ExecutionSessionError(
          'The stored project snapshot could not be verified.',
          503,
        )
      }
      const current = await coordinator.executionProjectSnapshot(
        identity,
        snapshotId,
      )
      if (!current.ok) return json({ error: current.error }, current.status)
      if (
        current.snapshot.state !== 'ready' ||
        current.snapshot.sha256 !== saved.sha256
      )
        throw new ExecutionSessionError(
          'The project snapshot is unavailable.',
          409,
        )
      return new Response(bytes, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(bytes.byteLength),
          'Content-Disposition': 'attachment; filename="project.gumsnap"',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy':
            "sandbox; default-src 'none'; frame-ancestors 'none'",
        },
      })
    } catch (error) {
      if (object && !object.body.locked)
        await object.body.cancel().catch(() => {})
      throw error
    }
  }
  if (request.method !== 'PUT')
    return new Response(null, {
      status: 405,
      headers: { Allow: 'GET, PUT', 'Cache-Control': 'no-store' },
    })
  if (query.size)
    throw new ExecutionSessionError('Invalid project snapshot request.', 400)
  const header = request.headers.get(metadataHeader)
  if (!header || new TextEncoder().encode(header).byteLength > 8192)
    throw new ExecutionSessionError(
      'Provide bounded project snapshot metadata.',
      400,
    )
  let input: z.infer<typeof executionSnapshotUploadSchema>
  try {
    input = executionSnapshotUploadSchema.parse(JSON.parse(header))
  } catch {
    throw new ExecutionSessionError('Invalid project snapshot metadata.', 400)
  }
  if (
    input.snapshot.snapshotId !== snapshotId ||
    input.commandId !== snapshotId
  )
    throw new ExecutionSessionError(
      'The snapshot ID does not match its command.',
      409,
    )
  const length = request.headers.get('content-length')
  if (
    length !== null &&
    (!/^(0|[1-9]\d*)$/.test(length) ||
      Number(length) !== input.snapshot.byteLength)
  )
    throw new ExecutionSessionError(
      'The project snapshot byte length does not match.',
      400,
    )
  const reserved = await coordinator.reserveExecutionSnapshot(identity, input)
  if (!reserved.ok) return json({ error: reserved.error }, reserved.status)
  const saved = reserved.snapshot.savedSnapshots.find(
    (item) => item.snapshotId === snapshotId,
  )
  if (!saved)
    throw new ExecutionSessionError(
      'The snapshot reservation could not be confirmed.',
      503,
    )
  const bytes = await readProjectSnapshotBody(request.body, saved.byteLength)
  await verifyBytes(bytes, saved)
  if (saved.state !== 'ready') {
    // Reading the upload may yield for longer than the lease or an access grant.
    const stillAuthorized = await coordinator.reserveExecutionSnapshot(
      identity,
      input,
    )
    if (!stillAuthorized.ok)
      return json({ error: stillAuthorized.error }, stillAuthorized.status)
    const key = executionSnapshotObjectKey(identity, snapshotId)
    try {
      const object =
        (await env.FILES.put(key, bytes, {
          onlyIf: { etagDoesNotMatch: '*' },
          sha256: saved.sha256,
          httpMetadata: { contentType: 'application/octet-stream' },
        })) ?? (await env.FILES.head(key))
      verifyObject(object, saved)
    } catch {
      throw new ExecutionSessionError(
        'The snapshot upload could not finish. Retry the same snapshot.',
        503,
      )
    }
  }
  const published = await coordinator.publishExecutionSnapshot(identity, input)
  return published.ok
    ? json(published.snapshot)
    : json({ error: published.error }, published.status)
}
