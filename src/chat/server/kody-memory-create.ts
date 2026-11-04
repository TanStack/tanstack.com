import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import {
  kodyMemoryCreateReviewSchema,
  kodyMemoryCreateSchema,
  kodyMemoryDetailSchema,
  kodyMemoryReviewSchema,
} from '../core/kody-memory'
import { seal, unseal } from './crypto'
import { KodyConnectionError, kodyCall } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import { KodyMemoryError } from './kody-memory'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'

// Apply verifies again in the same Kody execution as the write. The reviewed
// related records must still match, including their active/deleted state.
export const KODY_MEMORY_CREATE_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const candidate = params.candidate
  const verification = await kody.metaMemoryVerify({
    ...candidate, tags: [], source_uris: [], limit: 5,
  })
  const snapshot = {
    related: (verification.related_memories ?? []).map(item => ({
      id: item.id, subject: item.subject, summary: item.summary,
      status: item.status, dedupeKey: item.dedupe_key ?? null,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    recommendedActions: [...new Set(verification.recommended_actions ?? [])].sort(),
  }
  if (params.phase === 'review') return { state: 'review', snapshot }
  if (JSON.stringify(snapshot) !== JSON.stringify(params.expectedSnapshot))
    return { state: 'changed' }
  if (snapshot.related.some(item => item.status === 'active' &&
      item.subject.trim().toLowerCase() === candidate.subject.trim().toLowerCase() &&
      item.summary.trim().toLowerCase() === candidate.summary.trim().toLowerCase()))
    return { state: 'duplicate' }
  const result = await kody.metaMemoryUpsert({
    ...candidate, verified_by_agent: true,
    verification_reference: params.operationId,
  })
  const memory = result.memory
  return memory ? { state: 'applied', mode: result.mode, memory: {
    id: memory.id, status: memory.status, subject: memory.subject,
    summary: memory.summary, details: memory.details,
    category: memory.category, tags: memory.tags ?? [],
    createdAt: memory.created_at, updatedAt: memory.updated_at,
    sourceUris: memory.source_uris ?? [], canMutate: true,
  } } : { state: 'unconfirmed' }
}`

const relatedSchema = kodyMemoryReviewSchema.shape.related.element.extend({
  dedupeKey: z.string().nullable(),
})
const snapshotSchema = z.object({
  related: z.array(relatedSchema).max(5),
  recommendedActions: z
    .array(z.enum(['upsert', 'delete', 'upsert_and_delete', 'none']))
    .max(4),
})
const resultSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('review'), snapshot: snapshotSchema }),
  z.object({ state: z.literal('changed') }),
  z.object({ state: z.literal('duplicate') }),
  z.object({
    state: z.literal('applied'),
    mode: z.literal('created'),
    memory: kodyMemoryDetailSchema,
  }),
  z.object({ state: z.literal('unconfirmed') }),
])
const tokenSchema = z.object({
  version: z.literal(1),
  userId: z.string(),
  workspaceId: z.string(),
  accountFingerprint: z.string(),
  candidate: kodyMemoryCreateSchema,
  snapshot: snapshotSchema,
  operationId: z.uuid(),
  expiresAt: z.number().int(),
})

function duplicateId(
  candidate: z.infer<typeof kodyMemoryCreateSchema>,
  related: z.infer<typeof snapshotSchema>['related'],
) {
  const subject = candidate.subject.toLocaleLowerCase()
  const summary = candidate.summary.toLocaleLowerCase()
  return related.find(
    (item) =>
      item.status === 'active' &&
      item.subject.trim().toLocaleLowerCase() === subject &&
      item.summary.trim().toLocaleLowerCase() === summary,
  )?.id
}

function unwrap(raw: unknown) {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .safeParse(raw)
  if (!envelope.success || envelope.data.isError)
    throw new KodyMemoryError(
      'Kody could not confirm this memory. Search for it before trying again.',
    )
  const parsed = resultSchema.safeParse(envelope.data.structuredContent.result)
  if (!parsed.success)
    throw new KodyMemoryError('Kody returned an unsupported memory result.')
  if (parsed.data.state === 'changed')
    throw new KodyMemoryError(
      'Related Kody memories changed. Review this memory again.',
      409,
    )
  if (parsed.data.state === 'duplicate')
    throw new KodyMemoryError('This memory is already saved in Kody.', 409)
  if (parsed.data.state === 'unconfirmed')
    throw new KodyMemoryError(
      'Kody did not confirm this memory. Search for it before trying again.',
    )
  return parsed.data
}

async function account(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
) {
  const current = await kodyReferenceAccount(env, scope, options)
  if (!current.enabled)
    throw new KodyMemoryError(
      current.reason === 'blocked'
        ? 'Kody is disabled in this workspace.'
        : 'Connect Kody to save memory.',
      409,
    )
  return current
}

export async function reviewKodyMemoryCreate(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  rawCandidate: unknown,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const candidate = kodyMemoryCreateSchema.parse(rawCandidate)
  const before = await account(env, scope, options)
  let result
  try {
    result = unwrap(
      await call(
        env,
        scope.userId,
        'execute',
        kodyInternalReadArgs({
          code: KODY_MEMORY_CREATE_CODE,
          params: { phase: 'review', candidate },
          responseLimit: 100000,
        }),
        signal,
      ),
    )
    await assertKodyReferenceAccountUnchanged(env, scope, options, before)
  } catch (error) {
    if (error instanceof KodyMemoryError) throw error
    if (error instanceof KodyConnectionError)
      throw new KodyMemoryError(error.message, 409)
    throw new KodyMemoryError('Kody memory could not be reviewed right now.')
  }
  if (result.state !== 'review')
    throw new KodyMemoryError('Kody did not return a memory review.')
  const token = await seal(
    {
      version: 1,
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      accountFingerprint: before.fingerprint,
      candidate,
      snapshot: result.snapshot,
      operationId: crypto.randomUUID(),
      expiresAt: Date.now() + 5 * 60_000,
    },
    env.ENCRYPTION_KEY,
  )
  return kodyMemoryCreateReviewSchema.parse({
    token,
    related: result.snapshot.related.map(
      ({ dedupeKey: _key, ...item }) => item,
    ),
    ...(duplicateId(candidate, result.snapshot.related)
      ? { duplicateId: duplicateId(candidate, result.snapshot.related) }
      : {}),
  })
}

export async function applyKodyMemoryCreate(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  token: string,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  let saved
  try {
    saved = tokenSchema.parse(await unseal(token, env.ENCRYPTION_KEY))
  } catch {
    throw new KodyMemoryError(
      'The memory review expired. Review it again.',
      409,
    )
  }
  const before = await account(env, scope, options)
  if (
    saved.userId !== scope.userId ||
    saved.workspaceId !== scope.workspaceId ||
    saved.accountFingerprint !== before.fingerprint ||
    saved.expiresAt <= Date.now()
  )
    throw new KodyMemoryError(
      'The memory review expired or access changed. Review it again.',
      409,
    )
  if (duplicateId(saved.candidate, saved.snapshot.related))
    throw new KodyMemoryError('This memory is already saved in Kody.', 409)
  let result
  try {
    result = unwrap(
      await call(
        env,
        scope.userId,
        'execute',
        {
          code: KODY_MEMORY_CREATE_CODE,
          params: {
            phase: 'apply',
            candidate: saved.candidate,
            expectedSnapshot: saved.snapshot,
            operationId: saved.operationId,
          },
          idempotencyKey: 'banks-memory-create-' + saved.operationId,
          responseLimit: 100000,
        },
        signal,
      ),
    )
  } catch (error) {
    if (error instanceof KodyMemoryError) throw error
    throw new KodyMemoryError(
      'Kody may have saved this memory. Search for it or retry this same review.',
    )
  }
  if (
    result.state !== 'applied' ||
    result.memory.status !== 'active' ||
    result.memory.subject !== saved.candidate.subject ||
    result.memory.summary !== saved.candidate.summary ||
    result.memory.details !== saved.candidate.details
  )
    throw new KodyMemoryError(
      'Kody did not confirm the saved memory. Search for it before trying again.',
    )
  return result.memory
}
