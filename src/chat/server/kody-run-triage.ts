import { z } from 'zod'
import { kodyCall, type KodyEnvironment } from './kody'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'
import { KodyRunError } from './kody-run'

export const triageInputSchema = z
  .object({
    triage: z.enum(['open', 'ignored', 'resolved']),
    note: z.string().max(2000).optional(),
  })
  .strict()
export const KODY_RUN_TRIAGE_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const result = await kody.runUpdate({run_id: params.id, triage: params.triage, ...(params.note !== undefined ? {note:params.note} : {})})
  return {id:result.run.id, status:result.run.status, triage:result.run.error_triage ?? 'open'}
}`
export async function changeKodyRunTriage(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  runId: string,
  input: unknown,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const id = z.uuid().parse(runId)
  const change = triageInputSchema.parse(input)
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled) throw new KodyRunError('Kody is unavailable here.', 403)
  // Explicit desired-state update; never toggles and never deletes run evidence.
  await assertKodyReferenceAccountUnchanged(env, scope, options, before)
  const raw = await call(
    env,
    scope.userId,
    'execute',
    {
      code: KODY_RUN_TRIAGE_CODE,
      params: { id, ...change },
      responseLimit: 4000,
    },
    signal,
  )
  const result = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({
        result: z.object({
          id: z.uuid(),
          status: z.literal('error'),
          triage: triageInputSchema.shape.triage,
        }),
      }),
    })
    .safeParse(raw)
  if (
    !result.success ||
    result.data.isError ||
    result.data.structuredContent.result.id !== id ||
    result.data.structuredContent.result.triage !== change.triage
  )
    throw new KodyRunError(
      'The change could not be confirmed. Refresh the run before trying again.',
    )
  await assertKodyReferenceAccountUnchanged(env, scope, options, before)
  return result.data.structuredContent.result
}
