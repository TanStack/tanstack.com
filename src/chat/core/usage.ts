import type { ContextObservation } from './context-observation'
import type { ProviderRequestShape } from './provider-request-shape'

export interface UsageStep {
  id: string
  turnId: string
  workspaceId: string
  userId: string
  kind: 'model' | 'jev' | 'kody' | 'mcp'
  provider: string
  model?: string
  operation: string
  /** Version identifiers only, never prompts, profiles, references or tool output. */
  instructions?: {
    version: string
    sections: Array<{ id: string; version: string }>
    /** Applied account revision only. The private preference values stay out of usage. */
    responsePreferencesRevision?: number
  }
  startedAt: number
  durationMs?: number
  outcome:
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'aborted'
    | 'interrupted'
    | 'incomplete'
  /** Legacy model steps have no evidence about individual provider attempts. */
  accounting?: 'provider-attempts'
  /** Joined by the ledger when reading; never added to the parent cost. */
  attempts?: UsageAttempt[]
  /** Prepared context for this pass only. Never aggregate this across attempts. */
  context?: ContextObservation
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost:
    | { status: 'known' | 'estimated'; usd: number; source: string }
    | { status: 'unavailable' }
}
/** Provider-reported billing categories. Missing fields are unknown, not zero.
 * Counts can overlap (write duration tiers are subsets of writeTokens). */
export interface CacheUsage {
  readTokens?: number
  writeTokens?: number
  write5mTokens?: number
  write1hTokens?: number
}
export interface UsageAttempt {
  requestShape?: ProviderRequestShape
  /** Absent on legacy attempts whose input field may be protocol-specific. */
  tokenAccounting?: 'normalized-v1'
  rawInputTokens?: number
  rawOutputTokens?: number
  thinkingTokens?: number
  cacheUsage?: CacheUsage
  id: string
  stepId: string
  ordinal: number
  protocol: 'openai-chat' | 'openai-responses' | 'anthropic' | 'gemini'
  startedAt: number
  durationMs?: number
  bodyState:
    | 'pending'
    | 'complete'
    | 'incomplete'
    | 'failed'
    | 'cancelled'
    | 'interrupted'
  providerFinished: boolean
  usagePresent: boolean
  usageInvalid?: boolean
  httpStatus?: number
  finishReason?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost: UsageStep['cost']
}

export function usageAttemptComplete(attempt: UsageAttempt) {
  return (
    attempt.bodyState === 'complete' &&
    attempt.providerFinished &&
    attempt.usagePresent &&
    !attempt.usageInvalid &&
    attempt.cost.status !== 'unavailable'
  )
}

export function usageSummary(steps: UsageStep[]) {
  const summary = {
    usd: 0,
    unavailable: 0,
    estimated: false,
    pricedRecords: 0,
    observedAttempts: 0,
    unobservedModelSteps: 0,
  }
  const addPrice = (cost: UsageStep['cost']) => {
    if (cost.status === 'unavailable') return
    summary.usd += cost.usd
    summary.pricedRecords++
    summary.estimated ||= cost.status === 'estimated'
  }
  for (const step of steps) {
    if (step.accounting === 'provider-attempts') {
      // The logical pass is a summary, not another billable operation.
      const attempts = step.attempts ?? []
      summary.observedAttempts += attempts.length
      if (!attempts.length) summary.unavailable++
      for (const attempt of attempts) {
        addPrice(attempt.cost)
        if (!usageAttemptComplete(attempt)) summary.unavailable++
      }
    } else {
      addPrice(step.cost)
      if (step.cost.status === 'unavailable') summary.unavailable++
      if (step.kind === 'model') summary.unobservedModelSteps++
    }
  }
  return summary
}
