import { z } from 'zod'

export const toolEvidenceSchema = z.strictObject({
  observedCalls: z.number().int().nonnegative(),
  reportedErrors: z.number().int().nonnegative(),
  calls: z
    .array(
      z.strictObject({
        name: z.string().max(128),
        outcome: z.enum([
          'returned',
          'reported_error',
          'awaiting_action',
          'unknown',
        ]),
      }),
    )
    .max(96),
})
export type ToolEvidence = z.infer<typeof toolEvidenceSchema>

/** Describe execution receipts, not whether the user's objective was achieved.
 * Never copy arguments, tool output, or private reasoning into this summary. */
export function recordToolEvidence(
  evidence: ToolEvidence,
  name: string,
  ok: boolean,
  result: unknown,
) {
  const row =
    result && typeof result === 'object'
      ? (result as Record<string, unknown>)
      : undefined
  const status = typeof row?.status === 'string' ? row.status : ''
  const error = row?.error
  const failed =
    !ok ||
    row?.ok === false ||
    row?.isError === true ||
    (error !== undefined &&
      error !== null &&
      error !== false &&
      error !== '') ||
    ['failed', 'invalid_arguments', 'rejected'].includes(status)
  const outcome = failed
    ? 'reported_error'
    : ['unknown', 'already_attempted'].includes(status)
      ? 'unknown'
      : [
            'pending',
            'approval_required',
            'awaiting_user_approval',
            'awaiting_user_step',
            'proposed',
          ].includes(status)
        ? 'awaiting_action'
        : 'returned'
  evidence.observedCalls++
  if (failed) evidence.reportedErrors++
  evidence.calls.push({ name: name.slice(0, 128), outcome })
  if (evidence.calls.length > 96) evidence.calls.shift()
}
