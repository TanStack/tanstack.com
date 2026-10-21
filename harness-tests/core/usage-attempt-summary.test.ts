import { describe, expect, it } from 'vitest'
import {
  usageSummary,
  type UsageAttempt,
  type UsageStep,
} from '../../src/chat/core/usage'

const attempt = (patch: Partial<UsageAttempt> = {}): UsageAttempt => ({
  id: 'attempt-1',
  stepId: 'step',
  ordinal: 1,
  protocol: 'openai-chat',
  startedAt: 1,
  bodyState: 'complete',
  providerFinished: true,
  usagePresent: true,
  inputTokens: 100,
  outputTokens: 20,
  totalTokens: 120,
  cost: { status: 'estimated', usd: 0.01, source: 'Test rate' },
  ...patch,
})
const step = (patch: Partial<UsageStep> = {}): UsageStep => ({
  id: 'step',
  turnId: 'task',
  workspaceId: 'workspace',
  userId: 'user',
  kind: 'model',
  provider: 'included',
  operation: 'Model pass',
  startedAt: 1,
  outcome: 'succeeded',
  accounting: 'provider-attempts',
  cost: { status: 'unavailable' },
  ...patch,
})

describe('provider attempt totals', () => {
  it('retains a successful retry subtotal without hiding the preceding unpriced dispatch', () => {
    const result = usageSummary([
      step({
        attempts: [
          attempt({
            bodyState: 'failed',
            providerFinished: false,
            usagePresent: false,
            inputTokens: undefined,
            outputTokens: undefined,
            totalTokens: undefined,
            cost: { status: 'unavailable' },
          }),
          attempt({ id: 'attempt-2', ordinal: 2 }),
        ],
      }),
    ])
    expect(result).toEqual({
      usd: 0.01,
      unavailable: 1,
      estimated: true,
      pricedRecords: 1,
      observedAttempts: 2,
      unobservedModelSteps: 0,
    })
  })

  it('counts each attempt once and ignores the logical pass aggregate', () => {
    expect(
      usageSummary([
        step({
          cost: { status: 'estimated', usd: 0.03, source: 'Aggregate' },
          attempts: [
            attempt(),
            attempt({
              id: 'attempt-2',
              ordinal: 2,
              cost: { status: 'known', usd: 0.02, source: 'Provider' },
            }),
          ],
        }),
      ]),
    ).toMatchObject({ usd: 0.03, unavailable: 0, pricedRecords: 2 })
  })

  it.each([
    { bodyState: 'pending' as const },
    { bodyState: 'incomplete' as const },
    { bodyState: 'failed' as const },
    { bodyState: 'cancelled' as const },
    { bodyState: 'interrupted' as const },
    { providerFinished: false },
    { usagePresent: false },
    { usageInvalid: true },
  ])(
    'does not turn partial transport evidence into complete pricing: %j',
    (patch) => {
      expect(
        usageSummary([step({ attempts: [attempt(patch)] })]),
      ).toMatchObject({ usd: 0.01, unavailable: 1, pricedRecords: 1 })
    },
  )

  it('distinguishes an explicit provider zero from unavailable usage', () => {
    const zero = attempt({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: { status: 'known', usd: 0, source: 'Provider-reported' },
    })
    expect(usageSummary([step({ attempts: [zero] })])).toMatchObject({
      usd: 0,
      unavailable: 0,
      pricedRecords: 1,
    })
    expect(
      usageSummary([
        step({
          attempts: [
            attempt({
              usagePresent: false,
              cost: { status: 'unavailable' },
            }),
          ],
        }),
      ]),
    ).toMatchObject({ usd: 0, unavailable: 1, pricedRecords: 0 })
  })

  it('never falls back to parent pricing when attempt accounting has no joined rows yet', () => {
    expect(
      usageSummary([
        step({ cost: { status: 'known', usd: 9, source: 'Parent' } }),
      ]),
    ).toMatchObject({ usd: 0, unavailable: 1, pricedRecords: 0 })
  })

  it('keeps historical model prices visibly unobserved and leaves nonmodel pricing alone', () => {
    const legacy = step({
      accounting: undefined,
      cost: { status: 'known', usd: 0.2, source: 'Provider' },
    })
    const nonmodel = step({
      kind: 'mcp',
      accounting: undefined,
      cost: { status: 'known', usd: 0.3, source: 'Provider' },
    })
    // Persisted history can contain old rows with none of the new fields.
    const persisted: UsageStep[] = JSON.parse(
      JSON.stringify([legacy, nonmodel]),
    )
    expect(usageSummary(persisted)).toEqual({
      usd: 0.5,
      unavailable: 0,
      estimated: false,
      pricedRecords: 2,
      observedAttempts: 0,
      unobservedModelSteps: 1,
    })
    expect(persisted.every((record) => !('attempts' in record))).toBe(true)
  })
})
