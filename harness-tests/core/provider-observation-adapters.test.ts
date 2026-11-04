import { z } from 'zod'
import type { ProviderRequestShape } from '../../src/chat/core/provider-request-shape'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chat, maxIterations, toolDefinition } from '@tanstack/ai'
import { OPENAI_CHAT_MODELS } from '@tanstack/ai-openai'
import { ANTHROPIC_MODELS } from '@tanstack/ai-anthropic'
import { GEMINI_MODELS } from '@tanstack/ai-gemini'
import { GROQ_CHAT_MODELS } from '@tanstack/ai-groq'
import { GROK_CHAT_MODELS } from '@tanstack/ai-grok'
import { VERCEL_GATEWAY_CHAT_MODELS } from '@tanstack/ai-vercel-gateway'
import { adapterFor, type ProviderEnv } from '../../src/chat/server/providers'
import { connectionSchema, type Connection } from '../../src/chat/core/types'
import type {
  ProviderAttemptObserver,
  ProviderObservation,
  ProviderProtocol,
} from '../../src/chat/server/provider-observation'

afterEach(() => vi.unstubAllGlobals())

const frame = (value: unknown, event?: string) =>
  `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(value)}\n\n`
function fixture(protocol: ProviderProtocol) {
  let body: string
  if (protocol === 'openai-responses') {
    const response = {
      id: 'response_synthetic',
      model: 'synthetic',
      status: 'completed',
      output: [
        {
          type: 'message',
          id: 'message_synthetic',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'ok', annotations: [] }],
        },
      ],
      usage: { input_tokens: 6, output_tokens: 2, total_tokens: 8 },
    }
    body =
      frame({
        type: 'response.created',
        response: { ...response, status: 'in_progress', output: [] },
      }) +
      frame({
        type: 'response.output_text.delta',
        item_id: 'message_synthetic',
        output_index: 0,
        content_index: 0,
        delta: 'ok',
      }) +
      frame({ type: 'response.completed', response })
  } else if (protocol === 'anthropic') {
    body =
      frame(
        {
          type: 'message_start',
          message: {
            id: 'message_synthetic',
            role: 'assistant',
            model: 'synthetic',
            content: [],
            usage: { input_tokens: 6, output_tokens: 0 },
          },
        },
        'message_start',
      ) +
      frame(
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        },
        'content_block_start',
      ) +
      frame(
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'ok' },
        },
        'content_block_delta',
      ) +
      frame({ type: 'content_block_stop', index: 0 }, 'content_block_stop') +
      frame(
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: { output_tokens: 2 },
        },
        'message_delta',
      ) +
      frame({ type: 'message_stop' }, 'message_stop')
  } else if (protocol === 'gemini') {
    body = frame({
      candidates: [
        {
          index: 0,
          content: { role: 'model', parts: [{ text: 'ok' }] },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 6,
        candidatesTokenCount: 2,
        totalTokenCount: 8,
      },
    })
  } else {
    body =
      frame({
        id: 'completion_synthetic',
        choices: [
          { index: 0, delta: { content: 'ok' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 },
      }) + 'data: [DONE]\n\n'
  }
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream' },
  })
}
function recorder() {
  const attempts: {
    protocol: ProviderProtocol
    snapshots: ProviderObservation[]
    requestShape?: ProviderRequestShape
  }[] = []
  const observer: ProviderAttemptObserver = {
    start(protocol, requestShape) {
      const attempt = {
        protocol,
        requestShape,
        snapshots: [] as ProviderObservation[],
      }
      attempts.push(attempt)
      return {
        update(snapshot) {
          attempt.snapshots.push(snapshot)
        },
      }
    },
  }
  return { observer, attempts }
}
const environment = {
  INCLUDED_MODEL: '@cf/moonshotai/kimi-k2.6',
  AI_GATEWAY_ID: '',
} as ProviderEnv
const context = {
  turnId: 'synthetic-turn',
  workspaceId: 'synthetic-workspace',
  userId: 'synthetic-user',
  stepId: 'synthetic-step',
}
const gatewayEnv = {
  ...environment,
  AI_GATEWAY_ID: 'synthetic-gateway',
  AI_GATEWAY_ACCOUNT_ID: 'a'.repeat(32),
  AI_GATEWAY_TOKEN: 'synthetic-gateway-key',
} as ProviderEnv
const connection = (
  provider: Connection['provider'],
  model: string,
  extra = {},
) =>
  connectionSchema.parse({
    provider,
    model,
    apiKey: 'synthetic-provider-key',
    ...extra,
  })
async function invoke(
  connection: Connection,
  env: ProviderEnv,
  observer?: ProviderAttemptObserver,
) {
  const events = []
  for await (const event of chat({
    adapter: adapterFor(connection, env, context, observer)!,
    messages: [{ role: 'user', content: 'Synthetic offline adapter check' }],
    systemPrompts: ['Synthetic private system instructions'],
    tools: [
      toolDefinition({
        name: 'synthetic_lookup',
        description: 'Synthetic private tool description',
        inputSchema: z.object({}),
      }).server(async () => 'unused'),
    ],
    agentLoopStrategy: maxIterations(1),
  }))
    events.push(event)
  expect(events.filter((event) => event.type === 'RUN_ERROR')).toEqual([])
  expect(events.some((event) => event.type === 'RUN_FINISHED')).toBe(true)
}

const cases: {
  connection: Connection
  protocol: ProviderProtocol
  path: string
  gatewayPath?: string
}[] = [
  {
    connection: connection('openai', OPENAI_CHAT_MODELS[0]),
    protocol: 'openai-responses',
    path: '/responses',
    gatewayPath: 'openai',
  },
  {
    connection: connection('anthropic', ANTHROPIC_MODELS[0]),
    protocol: 'anthropic',
    path: '/messages',
    gatewayPath: 'anthropic',
  },
  {
    connection: connection('gemini', GEMINI_MODELS[0]),
    protocol: 'gemini',
    path: ':streamGenerateContent',
    gatewayPath: 'google-ai-studio',
  },
  {
    connection: connection('groq', GROQ_CHAT_MODELS[0]),
    protocol: 'openai-chat',
    path: '/chat/completions',
    gatewayPath: 'groq',
  },
  {
    connection: connection('grok', GROK_CHAT_MODELS[0]),
    protocol: 'openai-responses',
    path: '/responses',
    gatewayPath: 'grok',
  },
  {
    connection: connection('openrouter', 'synthetic/model'),
    protocol: 'openai-chat',
    path: '/chat/completions',
    gatewayPath: 'openrouter',
  },
  {
    connection: connection('vercel', VERCEL_GATEWAY_CHAT_MODELS[0]),
    protocol: 'openai-responses',
    path: '/responses',
  },
  {
    connection: connection('vercel', 'synthetic/custom-model'),
    protocol: 'openai-chat',
    path: '/chat/completions',
  },
  {
    connection: connection('cloudflare', '@cf/moonshotai/kimi-k2.6', {
      accountId: 'b'.repeat(32),
      gatewayId: 'personal-gateway',
    }),
    protocol: 'openai-chat',
    path: '/ai/v1/chat/completions',
  },
  {
    connection: connection('cf_gateway', 'openai/gpt-5-mini', {
      accountId: 'b'.repeat(32),
      gatewayId: 'personal-gateway',
    }),
    protocol: 'openai-chat',
    path: '/ai/v1/chat/completions',
  },
  {
    connection: connection('compatible', 'synthetic/custom-model', {
      baseUrl: 'https://models.example.com/v1',
    }),
    protocol: 'openai-chat',
    path: '/chat/completions',
  },
]

describe('provider constructor observation hooks', () => {
  it.each(cases)(
    'observes $connection.provider/$connection.model using its unchanged public SDK transport',
    async ({ connection, protocol, path, gatewayPath }) => {
      const requests: {
        url: string
        headers: Record<string, string>
        body: unknown
      }[] = []
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init)
          requests.push({
            url: request.url,
            headers: Object.fromEntries(request.headers),
            body: await request.json(),
          })
          return fixture(protocol)
        }),
      )
      await invoke(connection, gatewayEnv)
      const observed = recorder()
      await invoke(connection, gatewayEnv, observed.observer)
      expect(requests).toHaveLength(2)
      expect(requests[1].url).toBe(requests[0].url)
      expect(new URL(requests[1].url).pathname).toContain(path)
      expect(requests[1].body).toEqual(requests[0].body)
      // SDKs may use unique request IDs; compare the actual routing/auth/privacy fields.
      for (const name of [
        'authorization',
        'x-api-key',
        'x-goog-api-key',
        'cf-aig-authorization',
        'cf-aig-collect-log-payload',
        'cf-aig-metadata',
      ])
        expect(requests[1].headers[name]).toEqual(requests[0].headers[name])
      if (gatewayPath) {
        expect(requests[1].url).toContain(`/synthetic-gateway/${gatewayPath}/`)
        expect(requests[1].headers['cf-aig-collect-log-payload']).toBe('false')
      }
      if (connection.provider === 'compatible')
        expect(requests[1].url).toBe(
          'https://models.example.com/v1/chat/completions',
        )
      if (connection.provider === 'cf_gateway') {
        expect(requests[1].url).toBe(
          `https://api.cloudflare.com/client/v4/accounts/${'b'.repeat(32)}/ai/v1/chat/completions`,
        )
        expect(requests[1].headers['cf-aig-gateway-id']).toBe(
          'personal-gateway',
        )
        expect(requests[1].headers['cf-aig-collect-log-payload']).toBe('false')
      }
      expect(observed.attempts).toHaveLength(1)
      expect(observed.attempts[0].protocol).toBe(protocol)
      expect(observed.attempts[0].requestShape).toMatchObject({
        version: 2,
        boundary: 'provider-fetch',
        protocol,
        requestBytes: expect.any(Number),
        inputItemCount: expect.any(Number),
        toolEntryCount: 1,
      })
      expect(JSON.stringify(observed.attempts[0].requestShape)).not.toContain(
        'synthetic',
      )
      if (protocol !== 'openai-chat')
        expect(observed.attempts[0].requestShape).toHaveProperty(
          'instructionBytes',
          expect.any(Number),
        )
      expect(observed.attempts[0].snapshots.at(-1)).toMatchObject({
        inputTokens: 6,
        outputTokens: 2,
        usagePresent: true,
        providerFinished: true,
        httpStatus: 200,
        bodyState: 'complete',
      })
    },
  )

  it.each([false, true])(
    'preserves included binding receiver and gateway payload controls (gateway %s)',
    async (gateway) => {
      const calls: unknown[][] = []
      const binding = {
        marker: 'receiver',
        async run(...args: unknown[]) {
          expect(this.marker).toBe('receiver')
          calls.push(args)
          return fixture('openai-chat')
        },
      }
      const env = {
        ...(gateway ? gatewayEnv : environment),
        AI: binding,
      } as unknown as ProviderEnv
      const model = connection('included', '@cf/moonshotai/kimi-k2.6')
      await invoke(model, env)
      const observed = recorder()
      await invoke(model, env, observed.observer)
      expect(calls).toHaveLength(2)
      expect(calls[1]).toEqual(calls[0])
      expect(calls[1][2]).toMatchObject({ returnRawResponse: true })
      if (gateway)
        expect(calls[1][2]).toMatchObject({
          gateway: {
            id: 'synthetic-gateway',
            metadata: context,
            skipCache: true,
            collectLog: true,
          },
          extraHeaders: { 'cf-aig-collect-log-payload': 'false' },
        })
      else expect(calls[1][2]).not.toHaveProperty('extraHeaders')
      expect(observed.attempts).toHaveLength(1)
      expect(observed.attempts[0].snapshots.at(-1)).toMatchObject({
        inputTokens: 6,
        outputTokens: 2,
        providerFinished: true,
      })
    },
  )

  it('retains the default SDK retry for included binding and observes both actual attempts', async () => {
    let count = 0
    const env = {
      ...environment,
      AI: {
        async run() {
          if (++count === 1)
            throw new Error('Synthetic offline transport failure')
          return fixture('openai-chat')
        },
      },
    } as unknown as ProviderEnv
    const observed = recorder()
    await invoke(
      connection('included', '@cf/moonshotai/kimi-k2.6'),
      env,
      observed.observer,
    )
    expect(count).toBe(2)
    expect(observed.attempts).toHaveLength(2)
    expect(observed.attempts[0].snapshots.at(-1)?.bodyState).toBe('failed')
    expect(observed.attempts[1].snapshots.at(-1)).toMatchObject({
      usagePresent: true,
      inputTokens: 6,
      outputTokens: 2,
    })
  })

  it('retains maxRetries zero for compatible endpoints', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('Synthetic offline transport failure')
    })
    vi.stubGlobal('fetch', fetch)
    const observed = recorder()
    for await (const _event of chat({
      adapter: adapterFor(
        connection('compatible', 'synthetic', {
          baseUrl: 'https://models.example.com/v1',
        }),
        environment,
        context,
        observed.observer,
      )!,
      messages: [{ role: 'user', content: 'Offline check' }],
      agentLoopStrategy: maxIterations(1),
    })) {
      /* drain expected RUN_ERROR */
    }
    expect(fetch).toHaveBeenCalledOnce()
    expect(observed.attempts).toHaveLength(1)
    expect(observed.attempts[0].snapshots.at(-1)?.bodyState).toBe('failed')
  })
})
