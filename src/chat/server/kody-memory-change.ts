import { z } from 'zod'
import {
  kodyMemoryApplySchema,
  kodyMemoryChangeSchema,
  kodyMemoryDetailSchema,
  kodyMemoryIdSchema,
  kodyMemoryReviewSchema,
} from '../core/kody-memory'
import { seal, unseal } from './crypto'
import { KodyConnectionError, kodyCall, type KodyEnvironment } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import { KodyMemoryError } from './kody-memory'
import {
  kodyReferenceAccount,
  assertKodyReferenceAccountUnchanged,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'

// Keep the read, verification, comparison, and mutation in one Kody execution
// during apply. This minimizes the gap between checking the record and writing.
export const KODY_MEMORY_CHANGE_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const current = await kody.metaMemoryGet({ memory_id: params.id })
  if (!current || current.status !== 'active' || current.updated_at !== params.expectedUpdatedAt)
    return { state: 'changed' }
  const candidate = params.type === 'update'
    ? { subject: params.subject, summary: params.summary, details: params.details }
    : { subject: current.subject, summary: current.summary, details: current.details }
  const verification = await kody.metaMemoryVerify({
    ...candidate,
    ...(current.category ? { category: current.category } : {}),
    tags: current.tags ?? [],
    source_uris: current.source_uris ?? [],
    limit: 5,
  })
  const snapshot = {
    current: {
      id: current.id, status: current.status, updatedAt: current.updated_at,
      subject: current.subject, summary: current.summary, details: current.details,
      category: current.category, tags: current.tags ?? [],
      sourceUris: current.source_uris ?? [], dedupeKey: current.dedupe_key ?? null,
    },
    related: (verification.related_memories ?? []).map(item => ({
      id: item.id, subject: item.subject, summary: item.summary, status: item.status,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    recommendedActions: [...new Set(verification.recommended_actions ?? [])].sort(),
  }
  if (params.phase === 'review') return { state: 'review', snapshot }
  if (JSON.stringify(snapshot) !== JSON.stringify(params.expectedSnapshot))
    return { state: 'changed' }
  const result = params.type === 'update'
    ? await kody.metaMemoryUpsert({
        memory_id: params.id, ...candidate,
        ...(current.category ? { category: current.category } : {}),
        tags: current.tags ?? [], source_uris: current.source_uris ?? [],
        ...(current.dedupe_key ? { dedupe_key: current.dedupe_key } : {}),
        status: 'active', verified_by_agent: true,
        verification_reference: params.operationId,
      })
    : await kody.metaMemoryDelete({
        memory_id: params.id, force: false, verified_by_agent: true,
        verification_reference: params.operationId,
      })
  const memory = result.memory
  return memory ? { state: 'applied', memory: {
    id: memory.id, status: memory.status, subject: memory.subject,
    summary: memory.summary, details: memory.details,
    category: memory.category, tags: memory.tags ?? [],
    createdAt: memory.created_at, updatedAt: memory.updated_at,
    sourceUris: memory.source_uris ?? [],
  } } : { state: 'unconfirmed' }
}`

const snapshotSchema = z.object({
  current: z.object({
    id: kodyMemoryIdSchema,
    status: z.literal('active'),
    updatedAt: z.string().max(100),
    subject: z.string().max(300),
    summary: z.string().max(2000),
    details: z.string().max(20000),
    category: z.string().max(100).nullable(),
    tags: z.array(z.string().max(100)).max(30),
    sourceUris: z.array(z.string().max(1000)).max(20),
    dedupeKey: z.string().nullable(),
  }),
  related: kodyMemoryReviewSchema.shape.related,
  recommendedActions: z
    .array(z.enum(['upsert', 'delete', 'upsert_and_delete', 'none']))
    .max(4),
})
const changeResultSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('changed') }),
  z.object({ state: z.literal('review'), snapshot: snapshotSchema }),
  z.object({ state: z.literal('applied'), memory: kodyMemoryDetailSchema }),
  z.object({ state: z.literal('unconfirmed') }),
])
const tokenSchema = z.object({
  version: z.literal(1),
  userId: z.string(),
  workspaceId: z.string(),
  accountFingerprint: z.string(),
  id: kodyMemoryIdSchema,
  change: kodyMemoryChangeSchema,
  snapshot: snapshotSchema,
  expiresAt: z.number().int(),
})

function unwrap(raw: unknown) {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .safeParse(raw)
  if (!envelope.success || envelope.data.isError)
    throw new KodyMemoryError(
      'Kody could not confirm the memory change. Check the current record before trying again.',
    )
  const parsed = changeResultSchema.safeParse(
    envelope.data.structuredContent.result,
  )
  if (!parsed.success)
    throw new KodyMemoryError(
      'Kody returned an unsupported memory change result.',
    )
  if (parsed.data.state === 'changed')
    throw new KodyMemoryError(
      'This Kody memory changed. Open it again and review the latest version.',
      409,
    )
  if (parsed.data.state === 'unconfirmed')
    throw new KodyMemoryError(
      'Kody did not confirm the memory change. Check the current record before trying again.',
    )
  return parsed.data
}

async function access(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
) {
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled)
    throw new KodyMemoryError(
      before.reason === 'blocked'
        ? 'Kody is disabled in this workspace.'
        : 'Connect Kody to change memory.',
      409,
    )
  return before
}

export async function reviewKodyMemoryChange(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  id: string,
  rawChange: unknown,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const memoryId = kodyMemoryIdSchema.parse(id)
  const change = kodyMemoryChangeSchema.parse(rawChange)
  const before = await access(env, scope, options)
  let review
  try {
    review = unwrap(
      await call(
        env,
        scope.userId,
        'execute',
        kodyInternalReadArgs({
          code: KODY_MEMORY_CHANGE_CODE,
          params: { phase: 'review', id: memoryId, ...change },
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
  if (
    review.state !== 'review' ||
    review.snapshot.current.id !== memoryId ||
    review.snapshot.current.updatedAt !== change.expectedUpdatedAt
  )
    throw new KodyMemoryError(
      'This Kody memory changed. Open it again and review the latest version.',
      409,
    )
  const token = await seal(
    {
      version: 1,
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      accountFingerprint: before.fingerprint,
      id: memoryId,
      change,
      snapshot: review.snapshot,
      expiresAt: Date.now() + 5 * 60_000,
    },
    env.ENCRYPTION_KEY,
  )
  return kodyMemoryReviewSchema.parse({
    token,
    type: change.type,
    related: review.snapshot.related.filter((item) => item.id !== memoryId),
  })
}

export async function applyKodyMemoryChange(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  id: string,
  rawInput: unknown,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const memoryId = kodyMemoryIdSchema.parse(id)
  const input = kodyMemoryApplySchema.parse(rawInput)
  let saved
  try {
    saved = tokenSchema.parse(await unseal(input.token, env.ENCRYPTION_KEY))
  } catch {
    throw new KodyMemoryError(
      'The memory review expired. Review the current record again.',
      409,
    )
  }
  const before = await access(env, scope, options)
  if (
    saved.id !== memoryId ||
    saved.userId !== scope.userId ||
    saved.workspaceId !== scope.workspaceId ||
    saved.accountFingerprint !== before.fingerprint ||
    saved.expiresAt <= Date.now()
  )
    throw new KodyMemoryError(
      'The memory review expired or access changed. Review the current record again.',
      409,
    )
  let applied
  try {
    applied = unwrap(
      await call(
        env,
        scope.userId,
        'execute',
        {
          code: KODY_MEMORY_CHANGE_CODE,
          params: {
            phase: 'apply',
            id: memoryId,
            ...saved.change,
            expectedSnapshot: saved.snapshot,
            operationId: input.operationId,
          },
          idempotencyKey: 'banks-memory-' + input.operationId,
          responseLimit: 100000,
        },
        signal,
      ),
    )
  } catch (error) {
    if (error instanceof KodyMemoryError) throw error
    if (error instanceof KodyConnectionError)
      throw new KodyMemoryError(error.message, 409)
    throw new KodyMemoryError(
      'Kody may have changed the memory. Check the current record before trying again.',
    )
  }
  if (
    applied.state !== 'applied' ||
    applied.memory.id !== memoryId ||
    applied.memory.status !==
      (saved.change.type === 'delete' ? 'deleted' : 'active')
  )
    throw new KodyMemoryError(
      'Kody did not confirm the requested memory change. Check the current record.',
    )
  return applied.memory
}
