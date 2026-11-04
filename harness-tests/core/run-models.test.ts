import { chat, maxIterations } from '@tanstack/ai'
import { createCloudflareText } from '@tanstack/ai-cloudflare'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OPENAI_CHAT_MODELS } from '@tanstack/ai-openai'
import { ANTHROPIC_MODELS } from '@tanstack/ai-anthropic'
import { GEMINI_MODELS } from '@tanstack/ai-gemini'
import { GROQ_CHAT_MODELS } from '@tanstack/ai-groq'
import { GROK_CHAT_MODELS } from '@tanstack/ai-grok'
import { VERCEL_GATEWAY_CHAT_MODELS } from '@tanstack/ai-vercel-gateway'
import { OPENROUTER_CHAT_MODELS } from '@tanstack/ai-openrouter/model-meta'
import {
  defaultPolicy,
  connectionSchema,
  type Connection,
  type Credentials,
  type Provider,
} from '../../src/chat/core/types'
import type { RunModelSelection } from '../../src/chat/core/run-model'

const state = vi.hoisted(() => ({
  credentials: null as Credentials | null,
  read: vi.fn(),
}))
vi.mock('../../src/chat/server/credentials', () => ({
  readCredentials: (...args: unknown[]) => {
    state.read(...args)
    return Promise.resolve(state.credentials)
  },
}))
import {
  getRunModelCatalog,
  resolveRunModel,
  RunModelError,
  type ModelEnvironment,
} from '../../src/chat/server/run-models'

const env: ModelEnvironment = {
  INCLUDED_MODEL: '@cf/moonshotai/kimi-k2.6',
  ENCRYPTION_KEY: 'test-key',
}
const scope = { userId: 'viewer', policy: defaultPolicy, fixture: false }
const connection = (
  provider: Provider,
  model: string,
  extra: Partial<Connection> = {},
) =>
  connectionSchema.parse({ provider, model, apiKey: 'server-secret', ...extra })
const select = (
  provider: Provider,
  model: string,
  reasoning?: string,
): RunModelSelection => ({
  provider,
  model,
  ...(reasoning ? { reasoning } : {}),
})
function configured(
  provider: Provider,
  model: string,
  extra: Partial<Connection> = {},
) {
  const current = connection(provider, model, extra)
  state.credentials = {
    connection: current,
    connections: { [provider]: current },
  }
  return current
}

beforeEach(() => {
  state.credentials = null
  state.read.mockClear()
})

describe('run model configuration', () => {
  it('reuses credentials already read for this run without a second database query', async () => {
    configured('openai', 'gpt-5-mini', { apiKey: 'fresh-server-key' })
    const result = await resolveRunModel(env, scope, state.credentials)
    expect(result.connection.apiKey).toBe('fresh-server-key')
    expect(result.selection.provider).toBe('openai')
    expect(state.read).not.toHaveBeenCalled()
  })

  it('treats an already-read missing credential row as included without rereading', async () => {
    configured('openai', 'gpt-5-mini')
    const result = await resolveRunModel(env, scope, null)
    expect(result.selection.provider).toBe('included')
    expect(state.read).not.toHaveBeenCalled()
  })

  it('keeps fixture isolation when a caller supplies personal credentials', async () => {
    configured('openai', 'gpt-5-mini')
    const result = await resolveRunModel(
      env,
      { ...scope, fixture: true },
      state.credentials,
    )
    expect(result.selection.provider).toBe('included')
    expect(result.connection.apiKey).toBeUndefined()
    expect(state.read).not.toHaveBeenCalled()
  })

  it('uses the configured included model and preserves its existing default behavior', async () => {
    const result = await resolveRunModel(env, scope)
    expect(result.selection).toEqual(select('included', env.INCLUDED_MODEL))
    expect(result.connection.apiKey).toBeUndefined()
    expect(result.modelOptions).toEqual({
      max_tokens: 2048,
      reasoning_effort: null,
      chat_template_kwargs: { thinking: false },
    })
    expect(state.read).toHaveBeenCalledWith(env, 'viewer')
  })

  it('never guesses a model when the included model is missing or blank', async () => {
    for (const INCLUDED_MODEL of ['', ' '])
      await expect(
        resolveRunModel({ ...env, INCLUDED_MODEL }, scope),
      ).rejects.toMatchObject({ status: 503 })
  })

  it('rejects a missing included model at the runtime boundary', async () => {
    await expect(
      // Deliberately exercise a malformed environment received at runtime.
      // @ts-expect-error INCLUDED_MODEL is required by the application contract.
      resolveRunModel({ ENCRYPTION_KEY: env.ENCRYPTION_KEY }, scope),
    ).rejects.toMatchObject({ status: 503 })
  })

  it('isolates fixture runs from personal credentials and unavailable personal selections', async () => {
    configured('openai', 'gpt-5-mini')
    const result = await resolveRunModel(env, { ...scope, fixture: true })
    const catalog = await getRunModelCatalog(env, { ...scope, fixture: true })
    expect(result.selection.provider).toBe('included')
    expect(catalog.choices).toHaveLength(1)
    await expect(
      resolveRunModel(env, {
        ...scope,
        fixture: true,
        selection: select('openai', 'gpt-5-mini'),
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect(state.read).not.toHaveBeenCalled()
  })

  it('refreshes keys while retaining an explicit model and uses changed defaults only when omitted', async () => {
    configured('openai', 'gpt-5-mini', { apiKey: 'old-key' })
    const pinned = (await resolveRunModel(env, scope)).selection
    configured('openai', 'gpt-5-nano', { apiKey: 'new-key' })
    expect((await resolveRunModel(env, scope)).selection.model).toBe(
      'gpt-5-nano',
    )
    const repeated = await resolveRunModel(env, { ...scope, selection: pinned })
    expect(repeated.selection).toEqual(pinned)
    expect(repeated.connection.apiKey).toBe('new-key')
    expect(state.read).toHaveBeenCalledTimes(3)
  })

  it('uses a matching saved provider even after the account default changes to another provider', async () => {
    state.credentials = {
      connection: connection('anthropic', 'claude-sonnet-4-6'),
      connections: {
        openai: connection('openai', 'gpt-5-nano', {
          apiKey: 'saved-openai-key',
        }),
      },
    }
    const result = await resolveRunModel(env, {
      ...scope,
      selection: select('openai', 'gpt-5-mini'),
    })
    expect(result.connection.apiKey).toBe('saved-openai-key')
    expect(result.selection.model).toBe('gpt-5-mini')
  })

  it('supports the legacy single connection and does not accept a mismatched provider map entry', async () => {
    state.credentials = { connection: connection('openai', 'gpt-5-mini') }
    expect((await resolveRunModel(env, scope)).selection.provider).toBe(
      'openai',
    )
    state.credentials = {
      connection: connection('included', env.INCLUDED_MODEL),
      connections: { openai: connection('anthropic', 'claude-sonnet-4-6') },
    }
    await expect(
      resolveRunModel(env, {
        ...scope,
        selection: select('openai', 'gpt-5-mini'),
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('rejects stale included and configured custom model IDs instead of silently substituting', async () => {
    await expect(
      resolveRunModel(
        { ...env, INCLUDED_MODEL: '@cf/openai/gpt-oss-20b' },
        {
          ...scope,
          selection: select('included', env.INCLUDED_MODEL),
        },
      ),
    ).rejects.toMatchObject({ status: 409 })
    configured('openrouter', 'company/new-model')
    await expect(
      resolveRunModel(env, {
        ...scope,
        selection: select('openrouter', 'company/old-model'),
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('offers installed OpenRouter chat models with one saved key and rejects unknown selections', async () => {
    configured('openrouter', 'openrouter/auto')
    const catalog = await getRunModelCatalog(env, scope)
    const models = catalog.choices
      .filter((choice) => choice.selection.provider === 'openrouter')
      .map((choice) => choice.selection.model)
    expect(models).toContain('openrouter/auto')
    expect(models).toContain('moonshotai/kimi-k2.6')
    expect(models).not.toContain('moonshotai/kimi-k3:batch')
    expect(models.length).toBeLessThanOrEqual(512)
    expect(models.length).toBeLessThan(OPENROUTER_CHAT_MODELS.length)
    expect(
      (
        await resolveRunModel(env, {
          ...scope,
          selection: select('openrouter', 'moonshotai/kimi-k2.6'),
        })
      ).connection.apiKey,
    ).toBe('server-secret')
    await expect(
      resolveRunModel(env, {
        ...scope,
        selection: select('openrouter', 'untrusted/unlisted-model'),
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('requires account and Gateway IDs for a personal Cloudflare Gateway connection', async () => {
    configured('cf_gateway', 'openai/gpt-5-mini')
    await expect(resolveRunModel(env, scope)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('account ID'),
    })
    configured('cf_gateway', 'openai/gpt-5-mini', {
      accountId: 'a'.repeat(32),
    })
    await expect(resolveRunModel(env, scope)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('Gateway ID'),
    })
    configured('cf_gateway', 'openai/gpt-5-mini', {
      accountId: 'a'.repeat(32),
      gatewayId: 'personal',
    })
    expect((await resolveRunModel(env, scope)).selection).toEqual(
      select('cf_gateway', 'openai/gpt-5-mini'),
    )
  })

  it('rejects credentials, endpoints, null, and unknown fields supplied in public selections', async () => {
    configured('openai', 'gpt-5-mini')
    for (const selection of [
      null,
      { ...select('openai', 'gpt-5-mini'), apiKey: 'injected' },
      { ...select('openai', 'gpt-5-mini'), baseUrl: 'https://evil.example' },
      { ...select('openai', 'gpt-5-mini'), temperature: 1 },
    ])
      await expect(
        resolveRunModel(env, {
          ...scope,
          selection: selection as unknown as RunModelSelection,
        }),
      ).rejects.toMatchObject({ status: 400 })
  })
})

describe('model catalog and policy', () => {
  it('handles arbitrary unknown configured names without treating object properties as capabilities', async () => {
    for (const model of ['constructor', '__proto__', 'toString']) {
      configured('openai', model)
      const catalog = await getRunModelCatalog(env, scope)
      expect(
        catalog.choices.find((choice) => choice.selection.model === model),
      ).toMatchObject({
        reasoning: [{ value: 'default', label: 'Default' }],
        unavailableReason: expect.any(String),
      })
    }
  })
  it('advertises only saved providers and installed native catalogs, without any credentials or endpoints', async () => {
    const current = configured('openai', 'gpt-5-mini', {
      apiKey: 'private-key',
      baseUrl: 'https://private.example',
      accountId: 'a'.repeat(32),
      gatewayId: 'private-gateway',
    })
    state.credentials!.connections!.anthropic = connection(
      'anthropic',
      'claude-sonnet-4-6',
    )
    const catalog = await getRunModelCatalog(env, scope)
    expect(catalog.defaultSelection).toEqual(select('openai', current.model))
    expect(
      catalog.choices
        .filter((c) => c.selection.provider === 'openai')
        .map((c) => c.selection.model),
    ).toEqual([...OPENAI_CHAT_MODELS])
    expect(new Set(catalog.choices.map((c) => c.selection.provider))).toEqual(
      new Set(['included', 'openai', 'anthropic']),
    )
    const serialized = JSON.stringify(catalog)
    for (const secret of [
      'private-key',
      'private.example',
      'a'.repeat(32),
      'private-gateway',
      'apiKey',
      'baseUrl',
      'accountId',
    ])
      expect(serialized).not.toContain(secret)
    expect(
      catalog.choices.find((c) => c.selection.model === 'gpt-5-mini')
        ?.attachments,
    ).toEqual(['image', 'pdf'])
  })

  it('bounds the complete installed catalog and never substitutes for an unknown configured native default', async () => {
    configured('openai', 'future-native-model')
    const catalog = await getRunModelCatalog(env, scope)
    expect(catalog.defaultSelection.model).toBe('future-native-model')
    expect(
      catalog.choices.find((c) => c.selection.model === 'future-native-model')
        ?.unavailableReason,
    ).toMatch(/installed provider adapter/)
    await expect(resolveRunModel(env, scope)).rejects.toMatchObject({
      status: 409,
    })
    for (const [provider, models] of Object.entries({
      openai: OPENAI_CHAT_MODELS,
      anthropic: ANTHROPIC_MODELS,
      gemini: GEMINI_MODELS,
      groq: GROQ_CHAT_MODELS,
      grok: GROK_CHAT_MODELS,
      vercel: VERCEL_GATEWAY_CHAT_MODELS,
    }))
      state.credentials!.connections![provider as Provider] = connection(
        provider as Provider,
        models[0],
      )
    const all = await getRunModelCatalog(env, scope)
    expect(all.choices.length).toBeLessThanOrEqual(2048)
    expect(
      new Set(
        all.choices.map((c) => `${c.selection.provider}:${c.selection.model}`),
      ).size,
    ).toBe(all.choices.length)
  })

  it.each([
    { allowChatModels: false },
    { allowedProviders: ['included'] as Provider[] },
    { allowedModels: [env.INCLUDED_MODEL] },
  ])(
    'reports and enforces current workspace restrictions %j',
    async (patch) => {
      configured('openai', 'gpt-5-mini')
      const restricted = { ...scope, policy: { ...defaultPolicy, ...patch } }
      const catalog = await getRunModelCatalog(env, restricted)
      expect(
        catalog.choices.find((c) => c.selection.model === 'gpt-5-mini')
          ?.unavailableReason,
      ).toBeTruthy()
      await expect(resolveRunModel(env, restricted)).rejects.toMatchObject({
        status: 403,
      })
    },
  )

  it('reports missing keys, Cloudflare account IDs and unsafe compatible endpoints without leaking values', async () => {
    for (const saved of [
      connection('openai', 'gpt-5-mini', { apiKey: '' }),
      connection('cloudflare', '@cf/example/model'),
      connection('compatible', 'custom', {
        baseUrl: 'https://localhost/private',
      }),
    ]) {
      state.credentials = { connection: saved }
      const catalog = await getRunModelCatalog(env, scope)
      expect(
        catalog.choices.find(
          (c) =>
            c.selection.provider === saved.provider &&
            c.selection.model === saved.model,
        )?.unavailableReason,
      ).toBeTruthy()
      await expect(resolveRunModel(env, scope)).rejects.toMatchObject({
        status: 409,
      })
      expect(JSON.stringify(catalog)).not.toContain('localhost')
    }
  })

  it('allows only configured custom gateway IDs and uses the correct output token field', async () => {
    configured('vercel', 'company/custom-model')
    expect((await resolveRunModel(env, scope)).modelOptions).toEqual({
      max_tokens: 2048,
    })
    expect(
      (
        await resolveRunModel(env, {
          ...scope,
          selection: select('vercel', VERCEL_GATEWAY_CHAT_MODELS[0]),
        })
      ).modelOptions,
    ).toEqual({ max_output_tokens: 2048 })
    await expect(
      resolveRunModel(env, {
        ...scope,
        selection: select('vercel', 'company/unconfigured-model'),
      }),
    ).rejects.toMatchObject({ status: 409 })
    configured('compatible', 'custom', { baseUrl: 'https://models.example/v1' })
    expect((await resolveRunModel(env, scope)).connection.baseUrl).toBe(
      'https://models.example/v1',
    )
  })
})

describe('reviewed reasoning options', () => {
  it('keeps Kimi default off and exposes a genuine on switch without invented effort levels', async () => {
    const choice = (await getRunModelCatalog(env, scope)).choices[0]
    expect(choice.reasoning.map((r) => r.value)).toEqual([
      'default',
      'off',
      'on',
    ])
    const off = await resolveRunModel(env, {
      ...scope,
      selection: select('included', env.INCLUDED_MODEL, 'off'),
    })
    const on = await resolveRunModel(env, {
      ...scope,
      selection: select('included', env.INCLUDED_MODEL, 'on'),
    })
    expect(off.modelOptions).toEqual({
      max_tokens: 2048,
      reasoning_effort: null,
      chat_template_kwargs: { thinking: false },
    })
    expect(on.modelOptions).toEqual({
      max_tokens: 2048,
      chat_template_kwargs: { thinking: true },
    })
    await expect(
      resolveRunModel(env, {
        ...scope,
        selection: select('included', env.INCLUDED_MODEL, 'high'),
      }),
    ).rejects.toBeInstanceOf(RunModelError)
  })

  it.each([
    [
      'openai',
      'gpt-5-mini',
      'minimal',
      { max_output_tokens: 2048, reasoning: { effort: 'minimal' } },
    ],
    [
      'anthropic',
      'claude-sonnet-4-6',
      'low',
      {
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
      },
    ],
    [
      'gemini',
      'gemini-3.8-flash',
      'medium',
      { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'MEDIUM' } },
    ],
    [
      'gemini',
      'gemini-2.5-flash',
      'off',
      { maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
    ],
    [
      'gemini',
      'gemini-2.5-pro',
      'dynamic',
      { maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: -1 } },
    ],
    [
      'groq',
      'openai/gpt-oss-20b',
      'high',
      { max_tokens: 2048, reasoning_effort: 'high' },
    ],
    [
      'grok',
      'grok-4.6',
      'low',
      { max_output_tokens: 2048, reasoning: { effort: 'low' } },
    ],
  ] as const)(
    'maps %s %s %s to its installed adapter protocol',
    async (provider, model, reasoning, options) => {
      configured(provider, model)
      expect(
        (
          await resolveRunModel(env, {
            ...scope,
            selection: select(provider, model, reasoning),
          })
        ).modelOptions,
      ).toEqual(options)
      const implicit = await resolveRunModel(env, scope)
      const explicit = await resolveRunModel(env, {
        ...scope,
        selection: select(provider, model, 'default'),
      })
      expect(explicit).toEqual(implicit)
      expect(explicit.selection.reasoning).toBeUndefined()
    },
  )

  it('rejects unsupported reasoning and does not infer protocol support from gateway names', async () => {
    for (const [provider, model, reasoning] of [
      ['openai', 'gpt-4o-mini', 'high'],
      ['openai', 'gpt-5-mini', 'xhigh'],
      ['gemini', 'gemini-3.8-flash', 'minimal'],
      ['gemini', 'gemini-2.5-pro', 'off'],
      ['openrouter', 'openai/gpt-5-mini', 'high'],
      ['vercel', 'openai/gpt-5-mini', 'high'],
    ] as const) {
      configured(provider, model)
      await expect(
        resolveRunModel(env, {
          ...scope,
          selection: select(provider, model, reasoning),
        }),
      ).rejects.toMatchObject({ status: 400 })
    }
  })
})

describe('Kimi options at the actual adapter binding boundary', () => {
  it.each([
    ['@cf/moonshotai/kimi-k2.5', 'enable_thinking'],
    ['@cf/moonshotai/kimi-k2.6', 'thinking'],
  ])(
    'sends model-specific default/off/on options for %s',
    async (model, key) => {
      for (const reasoning of [undefined, 'off', 'on'] as const) {
        const resolved = await resolveRunModel(
          { ...env, INCLUDED_MODEL: model },
          {
            ...scope,
            fixture: true,
            ...(reasoning
              ? { selection: select('included', model, reasoning) }
              : {}),
          },
        )
        const run = vi.fn(
          async () =>
            new Response(
              'data: ' +
                JSON.stringify({
                  choices: [
                    {
                      index: 0,
                      delta: { content: 'ok' },
                      finish_reason: 'stop',
                    },
                  ],
                }) +
                '\n\ndata: [DONE]\n\n',
              { headers: { 'Content-Type': 'text/event-stream' } },
            ),
        )
        for await (const event of chat({
          adapter: createCloudflareText(model as any, {
            binding: { run } as any,
          }),
          messages: [{ role: 'user', content: 'Synthetic local check' }],
          modelOptions: resolved.modelOptions,
          agentLoopStrategy: maxIterations(1),
        }))
          expect(event.type).not.toBe('RUN_ERROR')
        expect(run).toHaveBeenCalledOnce()
        const sent = (
          run.mock.calls[0] as unknown as [string, Record<string, unknown>]
        )[1]
        expect(sent.chat_template_kwargs).toEqual({ [key]: reasoning === 'on' })
        expect(sent.reasoning_effort).toBe(
          reasoning === 'on' ? undefined : null,
        )
      }
    },
  )
})

describe('configured GLM 5.3 Flash controls', () => {
  const model = '@cf/zai-org/glm-5.3-flash'
  const includedEnv = { ...env, INCLUDED_MODEL: model }

  it('exposes reviewed controls only when configured and leaves the Kimi default unchanged', async () => {
    const currentCatalog = await getRunModelCatalog(env, scope)
    expect(
      currentCatalog.choices.some((choice) => choice.selection.model === model),
    ).toBe(false)
    await expect(
      resolveRunModel(env, { ...scope, selection: select('included', model) }),
    ).rejects.toMatchObject({ status: 409 })
    const catalog = await getRunModelCatalog(includedEnv, scope)
    expect(catalog.choices).toHaveLength(1)
    expect(catalog.choices[0]).toMatchObject({
      label: 'GLM 5.3 Flash',
      reasoning: [
        { value: 'default', label: 'Default' },
        { value: 'low', label: 'Low' },
        { value: 'high', label: 'High' },
      ],
    })
    const implicit = await resolveRunModel(includedEnv, scope)
    expect(implicit.modelOptions).toEqual({
      max_tokens: 2048,
      reasoning_effort: 'low',
    })
    expect(
      await resolveRunModel(includedEnv, {
        ...scope,
        selection: select('included', model, 'default'),
      }),
    ).toEqual(implicit)
    expect((await resolveRunModel(env, scope)).modelOptions).toEqual({
      max_tokens: 2048,
      reasoning_effort: null,
      chat_template_kwargs: { thinking: false },
    })
  })

  it('preserves configured Cloudflare defaults while exposing only explicit low/high controls', async () => {
    configured('cloudflare', model, { accountId: 'a'.repeat(32) })
    const catalog = await getRunModelCatalog(env, scope)
    expect(
      catalog.choices.find(
        (choice) => choice.selection.provider === 'cloudflare',
      ),
    ).toMatchObject({
      label: 'GLM 5.3 Flash',
      reasoning: [
        { value: 'default', label: 'Default' },
        { value: 'low', label: 'Low' },
        { value: 'high', label: 'High' },
      ],
    })
    expect((await resolveRunModel(env, scope)).modelOptions).toEqual({
      max_tokens: 2048,
    })
    expect(
      (
        await resolveRunModel(env, {
          ...scope,
          selection: select('cloudflare', model, 'default'),
        })
      ).modelOptions,
    ).toEqual({ max_tokens: 2048 })
    for (const reasoning of ['low', 'high'])
      expect(
        (
          await resolveRunModel(env, {
            ...scope,
            selection: select('cloudflare', model, reasoning),
          })
        ).modelOptions,
      ).toEqual({ max_tokens: 2048, reasoning_effort: reasoning })
  })

  it.each(['off', 'on', 'none', 'medium', 'max'])(
    'rejects the unreviewed %s effort for included and configured Cloudflare',
    async (reasoning) => {
      configured('cloudflare', model, { accountId: 'a'.repeat(32) })
      for (const provider of ['included', 'cloudflare'] as const)
        await expect(
          resolveRunModel(includedEnv, {
            ...scope,
            selection: select(provider, model, reasoning),
          }),
        ).rejects.toMatchObject({ status: 400 })
    },
  )

  it.each(['included', 'cloudflare'] as const)(
    'sends actual %s adapter requests without a thinking-disable flag',
    async (provider) => {
      if (provider === 'cloudflare')
        configured(provider, model, { accountId: 'a'.repeat(32) })
      for (const reasoning of [undefined, 'low', 'high']) {
        const resolved = await resolveRunModel(includedEnv, {
          ...scope,
          selection: select(provider, model, reasoning),
        })
        const run = vi.fn(
          async () =>
            new Response(
              'data: {"choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
              { headers: { 'content-type': 'text/event-stream' } },
            ),
        )
        for await (const event of chat({
          adapter: createCloudflareText(model, { binding: { run } as never }),
          messages: [{ role: 'user', content: 'Synthetic local check' }],
          modelOptions: resolved.modelOptions,
          agentLoopStrategy: maxIterations(1),
        }))
          expect(event.type).not.toBe('RUN_ERROR')
        expect(run).toHaveBeenCalledOnce()
        const [sentModel, input] = run.mock.calls[0] as unknown as [
          string,
          Record<string, unknown>,
        ]
        expect(sentModel).toBe(model)
        expect(input.max_tokens).toBe(2048)
        expect(input.reasoning_effort).toBe(
          reasoning ?? (provider === 'included' ? 'low' : undefined),
        )
        expect(input).not.toHaveProperty('chat_template_kwargs')
      }
    },
  )
})
