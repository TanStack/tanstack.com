import type { SqlStorage } from '@cloudflare/workers-types'
import { providerTokenTotals } from './provider-token-totals'
import { usageFields, type Usage, type Rates } from './usage-cost'
export {
  usageFields,
  configuredRates,
  defaultRates,
  type Rates,
} from './usage-cost'
import type { ChatMiddleware } from '@tanstack/ai'
import {
  usageAttemptComplete,
  usageSummary,
  type UsageAttempt,
  type UsageStep,
} from '../core/usage'
import type { TaskUsage } from '../core/task-usage'
import {
  contextObservationSchema,
  type ContextObservation,
} from '../core/context-observation'
import type {
  ProviderAttemptObserver,
  ProviderObservation,
  ProviderProtocol,
} from './provider-observation'
export type UsageContext = Pick<UsageStep, 'turnId' | 'workspaceId' | 'userId'>
export type UsageOperation = Pick<
  UsageStep,
  'kind' | 'provider' | 'model' | 'operation' | 'instructions'
>
/** Durable records live separately from conversation history and survive reset. */
export class UsageLedger {
  constructor(
    private sql: SqlStorage,
    private rates: Rates = {},
  ) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS usage_steps (id TEXT PRIMARY KEY, turn_id TEXT NOT NULL, started_at INTEGER NOT NULL, json TEXT NOT NULL)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS usage_attempts (id TEXT PRIMARY KEY, step_id TEXT NOT NULL, ordinal INTEGER NOT NULL, json TEXT NOT NULL, UNIQUE(step_id, ordinal))',
    )
    sql.exec(
      'CREATE INDEX IF NOT EXISTS usage_steps_started ON usage_steps(started_at)',
    )
    sql.exec(
      'CREATE INDEX IF NOT EXISTS usage_steps_turn ON usage_steps(turn_id)',
    )
  }
  private put(step: UsageStep) {
    this.sql.exec(
      'INSERT INTO usage_steps VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json',
      step.id,
      step.turnId,
      step.startedAt,
      JSON.stringify(step),
    )
  }
  private step(id: string): UsageStep | undefined {
    const row = this.sql
      .exec<{ json: string }>('SELECT json FROM usage_steps WHERE id=?', id)
      .toArray()[0]
    return row ? JSON.parse(row.json) : undefined
  }
  list(limit = 100): UsageStep[] {
    return this.sql
      .exec<{ json: string }>(
        'SELECT json FROM usage_steps ORDER BY started_at DESC,rowid DESC LIMIT ?',
        limit,
      )
      .toArray()
      .map((row) => {
        const step: UsageStep = JSON.parse(row.json)
        if (step.accounting !== 'provider-attempts') return step
        const attempts = this.attempts(step.id)
        return { ...step, ...this.attemptTotals(attempts), attempts }
      })
  }
  fundedSince(startedAt: number, turnId: string) {
    let usd = 0
    let unknown = false
    for (const row of this.sql
      .exec<{ json: string }>(
        'SELECT json FROM usage_steps WHERE started_at>=? AND turn_id=? ORDER BY started_at,id',
        startedAt,
        turnId,
      )
      .toArray()) {
      const step: UsageStep = JSON.parse(row.json)
      if (step.provider !== 'included' && step.provider !== 'typesafe') continue
      if (step.accounting === 'provider-attempts')
        step.attempts = this.attempts(step.id)
      const total = usageSummary([step])
      usd += total.usd
      unknown ||= total.unavailable > 0 || step.outcome === 'running'
    }
    return { usd, unknown }
  }
  /** All receipts for one task, including continuation and SDK retry attempts.
   * Iterate synchronously and return only counters, not unbounded raw history. */
  task(taskId: string): TaskUsage {
    const result: TaskUsage = {
      taskId,
      steps: 0,
      runningSteps: 0,
      totals: usageSummary([]),
    }
    const cursor = this.sql.exec<{ json: string }>(
      'SELECT json FROM usage_steps WHERE turn_id=? ORDER BY started_at,id',
      taskId,
    )
    for (const row of cursor.toArray()) {
      const step: UsageStep = JSON.parse(row.json)
      // Never trust an embedded logical-pass total over its durable attempts.
      if (step.accounting === 'provider-attempts')
        step.attempts = this.attempts(step.id)
      const totals = usageSummary([step])
      result.steps++
      if (step.outcome === 'running') result.runningSteps++
      result.totals.usd += totals.usd
      result.totals.estimated ||= totals.estimated
      result.totals.unavailable += totals.unavailable
      result.totals.pricedRecords += totals.pricedRecords
      result.totals.observedAttempts += totals.observedAttempts
      result.totals.unobservedModelSteps += totals.unobservedModelSteps
    }
    return result
  }
  private attempts(stepId: string): UsageAttempt[] {
    return this.sql
      .exec<{ json: string }>(
        'SELECT json FROM usage_attempts WHERE step_id=? ORDER BY ordinal',
        stepId,
      )
      .toArray()
      .map((row) => JSON.parse(row.json))
  }
  private putAttempt(attempt: UsageAttempt) {
    this.sql.exec(
      'INSERT INTO usage_attempts VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json',
      attempt.id,
      attempt.stepId,
      attempt.ordinal,
      JSON.stringify(attempt),
    )
  }
  private attemptTotals(attempts: UsageAttempt[]) {
    const closed = (attempt: UsageAttempt) =>
      attempt.bodyState === 'complete' &&
      attempt.providerFinished &&
      attempt.usagePresent &&
      !attempt.usageInvalid
    const sum = (field: 'inputTokens' | 'outputTokens' | 'totalTokens') =>
      attempts.length &&
      attempts.every(
        (attempt) => closed(attempt) && attempt[field] !== undefined,
      )
        ? attempts.reduce((total, attempt) => total + attempt[field]!, 0)
        : undefined
    const priced = attempts.filter(
      (attempt) => attempt.cost.status !== 'unavailable',
    )
    const complete = attempts.length > 0 && attempts.every(usageAttemptComplete)
    const cost: UsageStep['cost'] = complete
      ? {
          status: attempts.some(
            (attempt) => attempt.cost.status === 'estimated',
          )
            ? 'estimated'
            : 'known',
          usd: priced.reduce(
            (total, attempt) =>
              total +
              (attempt.cost.status === 'unavailable' ? 0 : attempt.cost.usd),
            0,
          ),
          source: 'Sum of recorded provider attempts',
        }
      : { status: 'unavailable' }
    return {
      inputTokens: sum('inputTokens'),
      outputTokens: sum('outputTokens'),
      totalTokens: sum('totalTokens'),
      cost,
    }
  }
  interrupt() {
    for (const row of this.sql
      .exec<{ json: string }>('SELECT json FROM usage_steps')
      .toArray()) {
      const step: UsageStep = JSON.parse(row.json)
      if (step.outcome === 'running') {
        step.outcome = 'interrupted'
        this.put(step)
      }
      if (step.accounting === 'provider-attempts')
        for (const attempt of this.attempts(step.id))
          if (attempt.bodyState === 'pending') {
            attempt.bodyState = 'interrupted'
            attempt.durationMs = Date.now() - attempt.startedAt
            this.putAttempt(attempt)
          }
    }
  }
  start(
    context: UsageContext,
    operation: UsageOperation,
    accounting?: 'provider-attempts',
  ) {
    const step: UsageStep = {
      ...context,
      ...operation,
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      outcome: 'running',
      cost: { status: 'unavailable' },
      ...(accounting ? { accounting } : {}),
    }
    this.put(step)
    return {
      id: step.id,
      context: (observation: ContextObservation) => {
        if (step.kind !== 'model' || this.step(step.id)?.outcome !== 'running')
          throw new Error('Context needs an active model pass.')
        step.context = contextObservationSchema.parse(observation)
        this.put(step)
      },
      usage: (usage: Usage) => {
        if (accounting) return
        Object.assign(
          step,
          usageFields(usage, step.provider, step.model, this.rates),
        )
        this.put(step)
      },
      finish: (outcome: Exclude<UsageStep['outcome'], 'running'>) => {
        // A pre-recovery callback cannot turn an interrupted pass into success.
        if (accounting && this.step(step.id)?.outcome === 'interrupted') return
        step.outcome = outcome
        step.durationMs = Date.now() - step.startedAt
        if (accounting)
          Object.assign(step, this.attemptTotals(this.attempts(step.id)))
        this.put(step)
      },
    }
  }
  /** One logical pass can dispatch several billable attempts inside a provider SDK.
   * Each attempt is recorded before dispatch. Transport metadata, not normalized
   * middleware counters, supplies its usage. No bodies or credentials are stored. */
  model(
    context: UsageContext,
    operation: UsageOperation,
    onIncomplete?: (reason: string) => void,
  ): {
    middleware: ChatMiddleware
    observer: ProviderAttemptObserver
    context(observation: ContextObservation): void
    assertComplete(): void
  } {
    let active: ReturnType<UsageLedger['start']> | undefined
    let settled = true
    let persistenceFailed = false
    let stoppedReason: string | undefined
    const incompleteReason = () => {
      if (persistenceFailed)
        return 'Provider usage could not be recorded. The response was stopped before further actions.'
      if (stoppedReason) return stoppedReason
      if (active && this.step(active.id)?.outcome === 'interrupted')
        return 'The provider response was interrupted. The partial response is preserved.'
      const last = active ? this.attempts(active.id).at(-1) : undefined
      if (!last || last.bodyState !== 'complete' || !last.providerFinished)
        return 'The provider response ended without a verified completion. The partial response is preserved.'
    }
    const finish = (outcome: Exclude<UsageStep['outcome'], 'running'>) => {
      if (settled || !active) return
      let result = outcome
      if (outcome === 'succeeded') {
        const reason = incompleteReason()
        if (reason) {
          result = 'incomplete'
          stoppedReason = reason
          onIncomplete?.(reason)
        }
      }
      active.finish(result)
      settled = true
    }
    const begin = () => {
      finish('succeeded')
      const reason =
        stoppedReason ?? (persistenceFailed ? incompleteReason() : undefined)
      if (reason) throw new Error(reason)
      active = this.start(context, operation, 'provider-attempts')
      settled = false
    }
    const observer: ProviderAttemptObserver = {
      start: (protocol: ProviderProtocol, requestShape) => {
        if (
          !active ||
          settled ||
          persistenceFailed ||
          stoppedReason ||
          this.step(active.id)?.outcome !== 'running'
        )
          throw new Error(
            'A provider attempt needs an active durable model pass.',
          )
        const stepId = active.id
        let attempt: UsageAttempt = {
          id: crypto.randomUUID(),
          stepId,
          ordinal: this.attempts(stepId).length + 1,
          protocol,
          ...(requestShape ? { requestShape } : {}),
          startedAt: Date.now(),
          bodyState: 'pending',
          providerFinished: false,
          usagePresent: false,
          cost: { status: 'unavailable' },
        }
        // A storage failure here prevents dispatch, never follows a paid call.
        try {
          this.putAttempt(attempt)
        } catch (error) {
          persistenceFailed = true
          throw error
        }
        return {
          update: (observation: ProviderObservation) => {
            try {
              const persisted = this.attempts(stepId).find(
                (row) => row.id === attempt.id,
              )
              if (!persisted) {
                persistenceFailed = true
                return
              }
              const totals = providerTokenTotals(protocol, observation)
              const next: UsageAttempt = {
                ...attempt,
                ...observation,
                ...totals,
                // Derived consistency belongs to this cumulative snapshot. Do
                // not retain an earlier mismatch once later counts resolve it.
                // Malformed raw fields remain sticky in the provider observer.
                usageInvalid: totals.usageInvalid,
                ...usageFields(
                  {
                    cacheBillingUnpriced: totals.usageInvalid,
                    cacheUsage: observation.cacheUsage,
                    cacheWriteTreatment:
                      protocol === 'anthropic' ? 'replacement' : undefined,
                    promptTokens: totals.inputTokens,
                    completionTokens: totals.outputTokens,
                    totalTokens: observation.totalTokens,
                    cost: observation.cost,
                  },
                  operation.provider,
                  operation.model,
                  this.rates,
                ),
              }
              if (persisted.bodyState === 'interrupted') {
                next.bodyState = 'interrupted'
                next.durationMs = persisted.durationMs
              } else if (observation.bodyState !== 'pending')
                next.durationMs = Date.now() - attempt.startedAt
              this.putAttempt(next)
              attempt = next
            } catch {
              // Never make the SDK retry a paid request because accounting failed.
              // The durable pending record stays unknown; stop outside transport.
              persistenceFailed = true
            }
          },
        }
      },
    }
    const middleware: ChatMiddleware = {
      name: 'gum-provider-usage',
      onIteration: begin,
      onStructuredOutputConfig: () => {
        // A separate schema-constrained request has no onIteration callback.
        begin()
      },
      // onUsage intentionally does not re-add or synthesize adapter-normalized counts.
      onChunk: (_ctx, chunk) => {
        if (chunk.type === 'RUN_ERROR') finish('failed')
      },
      onBeforeToolCall: () => {
        const reason = incompleteReason()
        if (reason) {
          stoppedReason = reason
          finish('incomplete')
          onIncomplete?.(reason)
          return { type: 'abort', reason }
        }
        finish('succeeded')
      },
      onFinish: () => finish('succeeded'),
      onError: () => finish('failed'),
      onAbort: () => finish('aborted'),
    }
    return {
      middleware,
      observer,
      context: (observation) => {
        if (!active || settled || persistenceFailed || stoppedReason)
          throw new Error('Context needs an active model pass.')
        active.context(observation)
      },
      assertComplete: () => {
        const reason = incompleteReason()
        if (reason) {
          stoppedReason = reason
          finish('incomplete')
          throw new Error(reason)
        }
        finish('succeeded')
      },
    }
  }
  async measure<T>(
    context: UsageContext,
    operation: UsageOperation,
    run: () => Promise<T>,
    getUsage?: (result: T) => Usage | undefined,
    signal?: AbortSignal,
  ): Promise<T> {
    const step = this.start(context, operation)
    try {
      const result = await run()
      const usage = getUsage?.(result)
      if (usage) step.usage(usage)
      const failed =
        typeof result === 'object' &&
        result !== null &&
        'isError' in result &&
        result.isError === true
      step.finish(failed ? 'failed' : 'succeeded')
      return result
    } catch (error) {
      step.finish(signal?.aborted ? 'aborted' : 'failed')
      throw error
    }
  }
  middleware(
    context: UsageContext,
    operation: UsageOperation,
    onStep?: (id: string) => void,
  ): ChatMiddleware {
    let active: ReturnType<UsageLedger['start']> | undefined
    let settled = false
    const finish = (outcome: Exclude<UsageStep['outcome'], 'running'>) => {
      if (!settled) active?.finish(outcome)
      settled = true
    }
    return {
      name: 'gum-usage',
      onIteration: () => {
        finish('succeeded')
        active = this.start(context, operation)
        settled = false
        onStep?.(active.id)
      },
      onUsage: (_ctx, usage) => {
        active?.usage(usage)
      },
      onChunk: (_ctx, chunk) => {
        if (chunk.type === 'RUN_FINISHED') finish('succeeded')
        if (chunk.type === 'RUN_ERROR') finish('failed')
      },
      onBeforeToolCall: () => {
        finish('succeeded')
      },
      onFinish: () => finish('succeeded'),
      onError: () => finish('failed'),
      onAbort: () => finish('aborted'),
    }
  }
}
