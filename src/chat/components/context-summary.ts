import { contextObservationSchema } from '../core/context-observation'
import type { UsageStep } from '../core/usage'

/** A previous request's accounting must never become the current context count. */
export function contextSummary({
  steps,
  taskId,
  transcriptEpoch,
}: {
  steps: readonly UsageStep[]
  taskId?: string
  transcriptEpoch?: string
}) {
  if (!taskId) return
  const step = steps
    .filter((step) => step.kind === 'model' && step.turnId === taskId)
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  if (!step) return
  const parsed = contextObservationSchema.safeParse(step.context)
  const context =
    parsed.success &&
    transcriptEpoch &&
    parsed.data.transcriptEpoch === transcriptEpoch
      ? parsed.data
      : undefined
  const attempt =
    step.accounting === 'provider-attempts'
      ? [...(step.attempts ?? [])].sort((a, b) => b.ordinal - a.ordinal)[0]
      : undefined
  const reported =
    !!attempt?.usagePresent &&
    !attempt.usageInvalid &&
    Number.isSafeInteger(attempt.inputTokens) &&
    attempt.inputTokens! >= 0
  const usageState = attempt?.usageInvalid
    ? ('invalid' as const)
    : reported
      ? ('reported' as const)
      : ('unavailable' as const)
  return {
    step,
    context,
    inputTokens: reported ? attempt!.inputTokens : undefined,
    cachedInputTokens:
      reported &&
      Number.isSafeInteger(attempt?.cacheUsage?.readTokens) &&
      attempt!.cacheUsage!.readTokens! >= 0
        ? attempt!.cacheUsage!.readTokens
        : undefined,
    inputTokensExcludeCache:
      reported &&
      attempt?.protocol === 'anthropic' &&
      attempt.tokenAccounting !== 'normalized-v1',
    attemptOrdinal: attempt?.ordinal,
    usageState,
    responseIncomplete:
      !!attempt &&
      (attempt.bodyState !== 'complete' || !attempt.providerFinished),
  }
}
export type ContextSummary = NonNullable<ReturnType<typeof contextSummary>>
