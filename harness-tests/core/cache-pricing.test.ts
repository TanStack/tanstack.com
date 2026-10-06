import { expect, it } from 'vitest'
import {
  configuredRates,
  defaultRates,
  usageFields,
  type Rates,
  type Usage,
} from '../../src/chat/server/usage-cost'
const rates: Rates = {
  'test/model': {
    inputPerMillion: 1,
    outputPerMillion: 2,
    cacheReadPerMillion: 0.1,
    cacheWrite5mPerMillion: 1.25,
    cacheWrite1hPerMillion: 2,
    source: 'Synthetic test schedule',
  },
}
const base: Usage = { promptTokens: 100, completionTokens: 10 }
it('prices the recorded Kimi cache-hit counts using its published categories', () => {
  const cost = usageFields(
    {
      promptTokens: 9542,
      completionTokens: 2,
      cacheUsage: { readTokens: 8896 },
    },
    'included',
    '@cf/moonshotai/kimi-k2.6',
    defaultRates,
  ).cost
  expect(cost.status).toBe('estimated')
  if (cost.status !== 'unavailable')
    expect(cost.usd).toBeCloseTo(0.00204506, 12)
})
function price(usage: Usage, configured = rates) {
  return usageFields(usage, 'test', 'model', configured).cost
}
it('prices inclusive input with cached reads without double-counting', () => {
  const cost = price({ ...base, cacheUsage: { readTokens: 20 } })
  expect(cost.status).toBe('estimated')
  if (cost.status !== 'unavailable') expect(cost.usd).toBeCloseTo(102 / 1e6, 12)
})
it('prices normalized Anthropic input and write duration tiers once', () => {
  const cost = price({
    ...base,
    cacheWriteTreatment: 'replacement',
    cacheUsage: {
      readTokens: 20,
      writeTokens: 30,
      write5mTokens: 10,
      write1hTokens: 20,
    },
  })
  expect(cost.status).toBe('estimated')
  if (cost.status !== 'unavailable')
    expect(cost.usd).toBeCloseTo(124.5 / 1e6, 12)
})
it('requires a rate for every positive category and reviewed write semantics', () => {
  expect(price({ ...base, cacheUsage: { writeTokens: 30 } }).status).toBe(
    'unavailable',
  )
  expect(
    price({
      ...base,
      cacheWriteTreatment: 'replacement',
      cacheUsage: { writeTokens: 30 },
    }).status,
  ).toBe('unavailable')
  expect(
    price(
      { ...base, cacheUsage: { readTokens: 20 } },
      {
        'test/model': {
          inputPerMillion: 1,
          outputPerMillion: 2,
          source: 'No cache schedule',
        },
      },
    ).status,
  ).toBe('unavailable')
})
it('accepts an explicit aggregate write rate when duration tiers are unavailable', () => {
  const cost = price(
    {
      ...base,
      cacheWriteTreatment: 'replacement',
      cacheUsage: { writeTokens: 30 },
    },
    {
      'test/model': { ...rates['test/model']!, cacheWritePerMillion: 1.5 },
    },
  )
  if (cost.status === 'unavailable') throw Error('Expected priced write')
  expect(cost.usd).toBeCloseTo(135 / 1e6, 12)
})
it('does not require rates for zero categories or override provider-reported cost', () => {
  expect(
    price({ ...base, cacheUsage: { readTokens: 0, writeTokens: 0 } }).status,
  ).toBe('estimated')
  expect(price({ ...base, cost: 0, cacheUsage: { writeTokens: 30 } })).toEqual({
    status: 'known',
    usd: 0,
    source: 'Provider-reported',
  })
})
it('rejects impossible category totals', () => {
  expect(price({ ...base, cacheUsage: { readTokens: 101 } }).status).toBe(
    'unavailable',
  )
  expect(
    price({
      ...base,
      cacheWriteTreatment: 'replacement',
      cacheUsage: { writeTokens: 30, write5mTokens: 20, write1hTokens: 20 },
    }).status,
  ).toBe('unavailable')
})
it('preserves configured cache fields and validates their rates', () => {
  expect(configuredRates(JSON.stringify(rates))['test/model']).toEqual(
    rates['test/model'],
  )
  expect(() =>
    configuredRates(
      JSON.stringify({
        'test/model': { ...rates['test/model'], cacheReadPerMillion: -1 },
      }),
    ),
  ).toThrow()
})
