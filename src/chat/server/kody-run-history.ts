import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import {
  kodyRunHistoryFilterSchema,
  kodyRunHistoryPageSchema,
  type KodyRunHistoryFilter,
} from '../core/kody-run-history'
import { KodyConnectionError, kodyCall } from './kody'
import {
  KODY_INTERNAL_READ_PREFIX,
  kodyInternalReadArgs,
} from './kody-internal-read'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'
import { KodyRunError } from './kody-run'

export const KODY_RUN_HISTORY_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const fields = ['id', 'surface', 'status', 'name', 'package_id', 'job_id', 'started_at', 'duration_ms', 'error_name', 'error_triage']
  const runs = []
  const seen = new Set()
  const status = params.triage && params.triage !== 'all' ? 'error' : params.status
  let cursor = params.cursor || null
  for (let page = 0; page < 5; page++) {
    const result = await kody.runList({ limit: 25, error_triage: params.triage || 'all', ...(status ? { status } : {}), ...(params.surface ? { surface: params.surface } : {}), ...(cursor ? { cursor } : {}) })
    if (!Array.isArray(result?.runs)) throw new Error('Unsupported Kody run page')
    for (const run of result.runs) {
      if (typeof run?.idempotency_key === 'string' && run.idempotency_key.startsWith(${JSON.stringify(KODY_INTERNAL_READ_PREFIX)})) continue
      runs.push(Object.fromEntries(fields.map(field => [field, run?.[field]])))
    }
    const next = result.next_cursor
    if (next !== null && next !== undefined && (typeof next !== 'string' || !next || seen.has(next))) throw new Error('Unsupported Kody run cursor')
    if (runs.length || !next) return { runs, next_cursor: next || null }
    seen.add(next)
    cursor = next
  }
  return { runs, next_cursor: cursor }
}`

export function projectKodyRunHistory(raw: unknown) {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .safeParse(raw)
  if (!envelope.success || envelope.data.isError)
    throw new KodyRunError('Kody run history could not be read.')
  const parsed = z
    .object({
      runs: z
        .array(
          z.object({
            id: z.uuid(),
            surface: z.string(),
            status: z.string(),
            name: z.string().nullish(),
            package_id: z.string().nullish(),
            job_id: z.string().nullish(),
            started_at: z.string(),
            duration_ms: z.number().nonnegative().nullish(),
            error_name: z.string().nullish(),
            error_triage: z.string().nullish(),
          }),
        )
        .max(100),
      next_cursor: z.string().nullish(),
    })
    .safeParse(envelope.data.structuredContent.result)
  if (!parsed.success)
    throw new KodyRunError('Kody returned an unsupported run page.')
  const page = parsed.data
  return kodyRunHistoryPageSchema.parse({
    runs: page.runs.map((run) => ({
      id: run.id,
      surface: run.surface.slice(0, 80),
      status: run.status.slice(0, 80),
      name: run.name?.slice(0, 200) ?? null,
      packageId: run.package_id?.slice(0, 300) ?? null,
      jobId: run.job_id?.slice(0, 300) ?? null,
      startedAt: run.started_at.slice(0, 100),
      durationMs: run.duration_ms ?? null,
      errorName: run.error_name?.slice(0, 200) ?? null,
      errorTriage: run.error_triage?.slice(0, 80) ?? null,
    })),
    nextCursor: page.next_cursor ?? null,
  })
}

export async function readKodyRunHistory(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  input: KodyRunHistoryFilter,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const filter = kodyRunHistoryFilterSchema.parse(input)
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled)
    throw new KodyRunError(
      before.reason === 'blocked'
        ? 'Kody is disabled in this workspace.'
        : 'Connect Kody to read its run history.',
      409,
    )
  try {
    const result = projectKodyRunHistory(
      await call(
        env,
        scope.userId,
        'execute',
        kodyInternalReadArgs({
          code: KODY_RUN_HISTORY_CODE,
          params: filter,
          responseLimit: 100000,
        }),
        signal,
      ),
    )
    await assertKodyReferenceAccountUnchanged(env, scope, options, before)
    return result
  } catch (error) {
    if (error instanceof KodyConnectionError)
      throw new KodyRunError(error.message, 409)
    if (error instanceof KodyRunError) throw error
    if (
      error instanceof Error &&
      error.message === 'Kody connection or access changed. Try again.'
    )
      throw new KodyRunError(error.message, 409)
    throw new KodyRunError('Kody run history could not be checked right now.')
  }
}
