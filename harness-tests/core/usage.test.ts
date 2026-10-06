import { describe, expect, it } from 'vitest'
import {
  usageFields,
  UsageLedger,
  configuredRates,
} from '../../src/chat/server/usage'
import { usageSummary, type UsageStep } from '../../src/chat/core/usage'
import {
  providerGateway,
  metadataOnlyBinding,
} from '../../src/chat/server/gateway'

describe('usage accounting', () => {
  it('does not turn missing or invalid tokens and costs into free usage', () => {
    expect(usageFields(undefined, 'jev', 'jev-latest')).toEqual({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      cost: { status: 'unavailable' },
    })
    expect(
      usageFields({ cost: NaN, promptTokens: -1 }, 'x', 'y').cost.status,
    ).toBe('unavailable')
  })
  it('keeps provider-reported zero and estimates separate', () => {
    expect(usageFields({ cost: 0 }, 'x', 'y').cost).toEqual({
      status: 'known',
      usd: 0,
      source: 'Provider-reported',
    })
    expect(
      usageFields({ promptTokens: 1000, completionTokens: 100 }, 'x', 'y', {
        'x/y': {
          inputPerMillion: 1,
          outputPerMillion: 2,
          source: '2026-09-21 operator schedule',
        },
      }).cost,
    ).toEqual({
      status: 'estimated',
      usd: 0.0012,
      source: '2026-09-21 operator schedule',
    })
  })
  it('uses the dated included-model rate and validates overrides', () => {
    const result = usageFields(
      { promptTokens: 1000, completionTokens: 100 },
      'included',
      '@cf/zai-org/glm-4.7-flash',
      configuredRates(),
    )
    expect(result.cost.status).toBe('estimated')
    if (result.cost.status !== 'unavailable')
      expect(result.cost.usd).toBeCloseTo(0.0001005)
    expect(() => configuredRates('{"x/y":{"inputPerMillion":-1}}')).toThrow()
  })
  it('reports partial totals honestly', () => {
    expect(
      usageSummary([
        { cost: { status: 'known', usd: 0.1 } },
        { cost: { status: 'unavailable' } },
      ] as UsageStep[]),
    ).toEqual({
      usd: 0.1,
      unavailable: 1,
      estimated: false,
      pricedRecords: 1,
      observedAttempts: 0,
      unobservedModelSteps: 0,
    })
  })
  it('estimates configured GLM 5.3 Flash usage with the published uncached rate and keeps missing usage unavailable', () => {
    const rates = configuredRates()
    const result = usageFields(
      { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      'included',
      '@cf/zai-org/glm-5.3-flash',
      rates,
    )
    expect(result.cost).toEqual({
      status: 'estimated',
      usd: 0.65,
      source:
        'Cloudflare published uncached rates, checked 2026-09-23: https://developers.cloudflare.com/workers-ai/models/glm-5.3-flash/',
    })
    expect(
      usageFields(
        { promptTokens: 1_000_000 },
        'included',
        '@cf/zai-org/glm-5.3-flash',
        rates,
      ).cost.status,
    ).toBe('unavailable')
    expect(
      usageFields(
        { cost: 0.12, promptTokens: 1_000_000, completionTokens: 1_000_000 },
        'included',
        '@cf/zai-org/glm-5.3-flash',
        rates,
      ).cost,
    ).toMatchObject({ status: 'known', usd: 0.12 })
  })
})

describe('gateway configuration', () => {
  const env = {
    AI_GATEWAY_ID: 'gum',
    AI_GATEWAY_ACCOUNT_ID: 'a'.repeat(32),
    AI_GATEWAY_TOKEN: 'gateway-run-token',
  }
  it('uses native endpoints and metadata-only logs', () => {
    const config = providerGateway('openai', env, {
      turnId: 'turn',
      workspaceId: 'workspace',
      userId: 'user',
    })!
    expect(config.baseURL).toBe(
      `https://gateway.ai.cloudflare.com/v1/${'a'.repeat(32)}/gum/openai`,
    )
    const headers = new Headers(config.defaultHeaders)
    expect(headers.get('cf-aig-collect-log')).toBe('true')
    expect(headers.get('cf-aig-collect-log-payload')).toBe('false')
    expect(JSON.parse(headers.get('cf-aig-metadata')!)).toEqual({
      turnId: 'turn',
      workspaceId: 'workspace',
      userId: 'user',
    })
  })
  it('does not misroute unsupported or unconfigured providers', () => {
    expect(providerGateway('compatible', env)).toBeUndefined()
    expect(providerGateway('vercel', env)).toBeUndefined()
    expect(providerGateway('openai', {})).toBeUndefined()
    expect(
      providerGateway('openai', {
        AI_GATEWAY_ID: 'gum',
        AI_GATEWAY_ACCOUNT_ID: 'a'.repeat(32),
      }),
    ).toBeUndefined()
    expect(() =>
      providerGateway('openai', {
        AI_GATEWAY_ID: 'gum',
        AI_GATEWAY_TOKEN: 'token',
      }),
    ).toThrow('account ID')
  })
  it('passes privacy headers through the Workers AI binding', async () => {
    let options: unknown
    const binding = {
      result: { ok: true },
      async run(_model: unknown, _input: unknown, opts: unknown) {
        options = opts
        return this.result
      },
    }
    const wrapped = metadataOnlyBinding(binding)
    const result = await wrapped.run(
      'model',
      {},
      { returnRawResponse: true, gateway: { id: 'gum' } },
    )
    expect(result).toBe(binding.result)
    expect(wrapped.result).toBe(binding.result)
    expect(options).toEqual({
      returnRawResponse: true,
      gateway: { id: 'gum' },
      extraHeaders: { 'cf-aig-collect-log-payload': 'false' },
    })
  })
})

describe('durable ledger lifecycle', () => {
  const context = { turnId: 'turn-1', userId: 'user', workspaceId: 'workspace' }
  const operation = {
    kind: 'model' as const,
    provider: 'included',
    model: 'glm',
    operation: 'Model pass',
  }
  function ledger() {
    const records = new Map<string, string>()
    const sql = {
      exec(query: string, ...args: unknown[]) {
        if (query.startsWith('INSERT'))
          records.set(args[0] as string, args[3] as string)
        return {
          toArray: () =>
            query.startsWith('SELECT')
              ? [...records.values()].map((json) => ({ json }))
              : [],
        }
      },
    }
    return { instance: new UsageLedger(sql as never), sql }
  }
  it('retains failures without inventing usage, then marks unfinished work interrupted', async () => {
    const { instance, sql } = ledger()
    await expect(
      instance.measure(context, operation, async () => {
        throw new Error('private provider error')
      }),
    ).rejects.toThrow()
    expect(instance.list()[0]).toMatchObject({
      turnId: 'turn-1',
      outcome: 'failed',
      cost: { status: 'unavailable' },
    })
    expect(JSON.stringify(instance.list())).not.toContain(
      'private provider error',
    )
    instance.start(context, operation)
    const restarted = new UsageLedger(sql as never)
    restarted.interrupt()
    expect(restarted.list().map((x) => x.outcome)).toEqual([
      'failed',
      'interrupted',
    ])
  })
  it('tracks separate model passes and does not double count terminal usage', async () => {
    const { instance } = ledger()
    const middleware = instance.middleware(context, operation)
    const ctx = {} as never
    await middleware.onIteration?.(ctx, { iteration: 0, messageId: 'one' })
    await middleware.onUsage?.(ctx, {
      promptTokens: 5,
      completionTokens: 2,
      totalTokens: 7,
      cost: 0.01,
    })
    await middleware.onIteration?.(ctx, { iteration: 1, messageId: 'two' })
    await middleware.onUsage?.(ctx, {
      promptTokens: 8,
      completionTokens: 3,
      totalTokens: 11,
      cost: 0.02,
    })
    await middleware.onFinish?.(ctx, {
      duration: 50,
      content: '',
      finishReason: 'stop',
      usage: {
        promptTokens: 13,
        completionTokens: 5,
        totalTokens: 18,
        cost: 0.03,
      },
    })
    expect(instance.list()).toHaveLength(2)
    expect(usageSummary(instance.list()).usd).toBeCloseTo(0.03)
  })
  it('retains instruction versions across model passes and ledger reconstruction', async () => {
    const { instance, sql } = ledger()
    const instructions = {
      version: 'gum-assistant-v2',
      sections: [
        { id: 'core', version: '2' },
        { id: 'profile', version: '1' },
      ],
    }
    const middleware = instance.middleware(context, {
      ...operation,
      instructions,
    })
    for (let iteration = 0; iteration < 2; iteration++)
      await middleware.onIteration?.({} as never, {
        iteration,
        messageId: String(iteration),
      })
    await middleware.onAbort?.({} as never, {
      duration: 0,
      cancelRequested: false,
    })
    const recovered = new UsageLedger(sql as never).list()
    expect(recovered).toHaveLength(2)
    expect(recovered.map((step) => step.instructions)).toEqual([
      instructions,
      instructions,
    ])
    expect(recovered.map((step) => step.outcome)).toEqual([
      'succeeded',
      'aborted',
    ])
    const legacyStep = instance.start(context, operation)
    legacyStep.finish('succeeded')
    expect(instance.list().at(-1)?.instructions).toBeUndefined()
  })
})

it('estimates Jev input cost from published rates without charging for output', () => {
  const rates = configuredRates()
  const usage = usageFields(
    {
      promptTokens: 1_000_000,
      completionTokens: 50_000,
      totalTokens: 1_050_000,
    },
    'typesafe',
    'jev-latest',
    rates,
  )
  expect(usage.cost.status).toBe('estimated')
  if (usage.cost.status !== 'estimated')
    throw new Error('Expected estimated Jev usage')
  expect(usage.cost.usd).toBeCloseTo(0.042)
  expect(usage.cost.source).toContain('https://docs.typesafe.ai/models')
})

it('keeps provider-reported cost when cache rates are unavailable', () => {
  expect(
    usageFields({ cost: 0, cacheBillingUnpriced: true }, 'x', 'y').cost,
  ).toEqual({ status: 'known', usd: 0, source: 'Provider-reported' })
})
