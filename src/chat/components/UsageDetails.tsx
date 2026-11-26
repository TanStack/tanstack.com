import { usageSummary, type UsageAttempt, type UsageStep } from '../core/usage'
const money = (usd: number) => `$${usd.toFixed(6)}`
export function usageCostLabel(totals: ReturnType<typeof usageSummary>) {
  if (!totals.pricedRecords) return 'Unavailable'
  const partial = totals.unavailable > 0 || totals.unobservedModelSteps > 0
  return `${money(totals.usd)} ${partial ? 'partial ' : ''}${totals.estimated ? 'estimate' : 'reported'}`
}

export function AttemptTokenDetails({ attempt }: { attempt: UsageAttempt }) {
  if (attempt.usageInvalid || !attempt.usagePresent) return null
  const cache = attempt.cacheUsage
  const rows = [
    ['Cache read', cache?.readTokens],
    ['Cache write', cache?.writeTokens],
    ['Cache write, 5 minutes', cache?.write5mTokens],
    ['Cache write, 1 hour', cache?.write1hTokens],
    ['Thinking, included in output', attempt.thinkingTokens],
  ] as const
  return (
    <>
      {attempt.protocol === 'anthropic' && !attempt.tokenAccounting && (
        <p>Older record: input may exclude cached tokens.</p>
      )}
      {!cache && <p>Cache usage not reported.</p>}
      {rows
        .filter(([, count]) => count !== undefined)
        .map(([label, count]) => (
          <p key={label}>
            {label}: {count} tokens
          </p>
        ))}
      {(cache?.write5mTokens !== undefined ||
        cache?.write1hTokens !== undefined) && (
        <small>Write durations are part of the cache-write total.</small>
      )}
    </>
  )
}

export function UsageDetails({ steps }: { steps: UsageStep[] }) {
  if (!steps.length) return null
  const totals = usageSummary(steps)
  return (
    <details className="trace-item usage">
      <summary>
        Recent usage · {steps.length} {steps.length === 1 ? 'step' : 'steps'} ·{' '}
        {usageCostLabel(totals)}
      </summary>
      {totals.unavailable > 0 && (
        <p>Some provider usage is unavailable or incomplete.</p>
      )}
      {steps.map((step) => (
        <details key={step.id}>
          <summary>
            {step.operation} · {step.outcome} ·{' '}
            {step.durationMs === undefined
              ? 'duration unavailable'
              : `${(step.durationMs / 1000).toFixed(2)}s`}
          </summary>
          <p>
            {step.provider}
            {step.model ? ` / ${step.model}` : ''}
          </p>
          {step.accounting === 'provider-attempts' ? (
            <>
              <p>{usageCostLabel(usageSummary([step]))}</p>
              {step.attempts?.length ? (
                [...step.attempts]
                  .sort((a, b) => a.ordinal - b.ordinal)
                  .map((attempt) => (
                    <details key={attempt.id}>
                      <summary>
                        Attempt {attempt.ordinal} · {attempt.bodyState}
                        {attempt.durationMs !== undefined &&
                          ` · ${(attempt.durationMs / 1000).toFixed(2)}s`}
                      </summary>
                      {attempt.httpStatus !== undefined && (
                        <p>HTTP {attempt.httpStatus}</p>
                      )}
                      <p>
                        {attempt.providerFinished
                          ? `Provider finish: ${attempt.finishReason ?? 'reported'}`
                          : 'No provider finish was observed.'}
                      </p>
                      <p>
                        {attempt.usageInvalid
                          ? 'Provider usage was invalid.'
                          : !attempt.usagePresent
                            ? 'Provider usage was not reported.'
                            : `${attempt.inputTokens ?? '?'} input · ${attempt.outputTokens ?? '?'} output tokens`}
                      </p>
                      <AttemptTokenDetails attempt={attempt} />
                      <p>
                        {attempt.cost.status === 'unavailable'
                          ? 'Cost unavailable'
                          : `${money(attempt.cost.usd)} ${attempt.cost.status} · ${attempt.cost.source}`}
                      </p>
                    </details>
                  ))
              ) : (
                <p>No provider attempts recorded yet.</p>
              )}
            </>
          ) : (
            <>
              {step.kind === 'model' && (
                <p>Provider attempts were not recorded for this step.</p>
              )}
              <p>
                {step.inputTokens ?? '?'} input · {step.outputTokens ?? '?'}{' '}
                output tokens
              </p>
              <p>
                {step.cost.status === 'unavailable'
                  ? 'Cost unavailable'
                  : `${money(step.cost.usd)} ${step.cost.status} · ${step.cost.source}`}
              </p>
            </>
          )}
          <small>
            Turn {step.turnId} · Step {step.id}
          </small>
        </details>
      ))}
    </details>
  )
}
