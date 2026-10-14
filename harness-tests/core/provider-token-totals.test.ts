import { expect, it } from 'vitest'
import { providerTokenTotals } from '../../src/chat/server/provider-token-totals'
import type { ProviderObservation } from '../../src/chat/server/provider-observation'
const base: ProviderObservation = {
  usagePresent: true,
  providerFinished: true,
  bodyState: 'complete',
  inputTokens: 7,
}
it('adds Anthropic cache categories once, excluding write-tier subsets', () => {
  expect(
    providerTokenTotals('anthropic', {
      ...base,
      cacheUsage: {
        readTokens: 20,
        writeTokens: 30,
        write5mTokens: 10,
        write1hTokens: 20,
      },
    }),
  ).toEqual({
    tokenAccounting: 'normalized-v1',
    rawInputTokens: 7,
    rawOutputTokens: undefined,
    outputTokens: undefined,
    inputTokens: 57,
  })
})
it.each(['openai-chat', 'openai-responses', 'gemini'] as const)(
  'does not add cache subsets to %s input',
  (protocol) => {
    expect(
      providerTokenTotals(protocol, { ...base, cacheUsage: { readTokens: 5 } })
        .inputTokens,
    ).toBe(7)
  },
)
it('does not treat missing Anthropic categories as zero', () => {
  expect(providerTokenTotals('anthropic', base).inputTokens).toBeUndefined()
  expect(
    providerTokenTotals('anthropic', {
      ...base,
      cacheUsage: { readTokens: 0, writeTokens: 0 },
    }).inputTokens,
  ).toBe(7)
})
it('rejects impossible or overflowing totals', () => {
  expect(
    providerTokenTotals('openai-chat', {
      ...base,
      cacheUsage: { readTokens: 8 },
    }),
  ).toMatchObject({ usageInvalid: true, inputTokens: undefined })
  expect(
    providerTokenTotals('anthropic', {
      ...base,
      cacheUsage: { readTokens: Number.MAX_SAFE_INTEGER, writeTokens: 1 },
    }),
  ).toMatchObject({ usageInvalid: true, inputTokens: undefined })
  expect(
    providerTokenTotals('anthropic', {
      ...base,
      cacheUsage: {
        readTokens: 1,
        writeTokens: 3,
        write5mTokens: 3,
        write1hTokens: 1,
      },
    }),
  ).toMatchObject({ usageInvalid: true, inputTokens: undefined })
})

it('includes Gemini thinking in output and keeps cached input a subset', () => {
  expect(
    providerTokenTotals('gemini', {
      ...base,
      outputTokens: 2,
      thinkingTokens: 3,
      totalTokens: 12,
      cacheUsage: { readTokens: 5 },
    }),
  ).toMatchObject({ inputTokens: 7, rawOutputTokens: 2, outputTokens: 5 })
})
it('uses Gemini total minus input when only the thinking breakdown is missing', () => {
  expect(
    providerTokenTotals('gemini', { ...base, outputTokens: 2, totalTokens: 12 })
      .outputTokens,
  ).toBe(5)
  expect(
    providerTokenTotals('gemini', { ...base, outputTokens: 2 }).outputTokens,
  ).toBeUndefined()
})
it('rejects inconsistent Gemini output totals', () => {
  expect(
    providerTokenTotals('gemini', {
      ...base,
      outputTokens: 2,
      thinkingTokens: 3,
      totalTokens: 9,
    }),
  ).toMatchObject({ usageInvalid: true, outputTokens: undefined })
})
