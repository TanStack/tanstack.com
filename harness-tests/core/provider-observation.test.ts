import { Buffer } from 'node:buffer'
import { chat } from '@tanstack/ai'
import { createCloudflareText } from '@tanstack/ai-cloudflare'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import { describe, expect, it, vi } from 'vitest'
import {
  observeProviderBinding,
  observeProviderFetch,
  type ProviderAttemptObserver,
  type ProviderObservation,
  type ProviderProtocol,
} from '../../src/chat/server/provider-observation'

const encoder = new TextEncoder()
const frame = (value: unknown, event?: string) =>
  `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(value)}\n\n`
const done = 'data: [DONE]\n\n'
function recorder() {
  const attempts: {
    protocol: ProviderProtocol
    snapshots: ProviderObservation[]
  }[] = []
  const observer: ProviderAttemptObserver = {
    start(protocol) {
      const attempt = { protocol, snapshots: [] as ProviderObservation[] }
      attempts.push(attempt)
      return { update: (snapshot) => attempt.snapshots.push(snapshot) }
    },
  }
  return { observer, attempts, last: () => attempts.at(-1)!.snapshots.at(-1)! }
}
function responseBytes(
  bytes: Uint8Array,
  contentType = 'text/event-stream',
  chunkSize = 7,
) {
  let offset = 0
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === bytes.length) {
          controller.close()
          return
        }
        controller.enqueue(
          bytes.subarray(
            offset,
            (offset += Math.min(chunkSize, bytes.length - offset)),
          ),
        )
      },
    }),
    { headers: { 'content-type': contentType } },
  )
}
async function capture(
  protocol: ProviderProtocol,
  raw: string,
  contentType = 'text/event-stream',
  chunkSize = 7,
) {
  const result = recorder()
  const bytes = encoder.encode(raw)
  const fetchImpl = vi.fn(async () =>
    responseBytes(bytes, contentType, chunkSize),
  )
  const response = await observeProviderFetch(
    protocol,
    result.observer,
    fetchImpl,
  )('https://provider.invalid/')
  expect(Buffer.from(await response.arrayBuffer()).equals(bytes)).toBe(true)
  expect(fetchImpl).toHaveBeenCalledOnce()
  return result
}

describe('provider transport observations', () => {
  it('forwards split Unicode and CRLF SSE unchanged, keeping trailers after the finish event', async () => {
    const result = recorder()
    let source!: ReadableStreamDefaultController<Uint8Array>
    const response = await observeProviderFetch(
      'openai-chat',
      result.observer,
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              source = controller
            },
          }),
          { headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
        ),
    )('https://provider.invalid/')
    const content = frame({
      choices: [{ delta: { content: '雪🙂' }, finish_reason: 'stop' }],
    }).replaceAll('\n', '\r\n')
    const bytes = encoder.encode(content)
    const reader = response.body!.getReader()
    for (const byte of bytes) {
      source.enqueue(Uint8Array.of(byte))
      expect((await reader.read()).value).toEqual(Uint8Array.of(byte))
    }
    expect(result.last()).toMatchObject({
      providerFinished: false,
      finishReason: 'stop',
      bodyState: 'pending',
      usagePresent: false,
    })
    const tail =
      frame({
        choices: [],
        usage: {
          prompt_tokens: 6,
          completion_tokens: 2,
          total_tokens: 8,
          cost: 0.0001,
        },
      }) + done
    source.enqueue(encoder.encode(tail))
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(tail)
    expect(result.last().bodyState).toBe('pending')
    source.close()
    expect((await reader.read()).done).toBe(true)
    expect(result.last()).toEqual({
      usagePresent: true,
      inputTokens: 6,
      outputTokens: 2,
      totalTokens: 8,
      cost: 0.0001,
      providerFinished: true,
      finishReason: 'stop',
      httpStatus: 200,
      bodyState: 'complete',
    })
  })

  it.each([
    { usage: undefined, expected: { usagePresent: false } },
    { usage: null, expected: { usagePresent: false } },
    { usage: {}, expected: { usagePresent: true } },
    {
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost: 0,
      },
      expected: {
        usagePresent: true,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
      },
    },
    {
      usage: { prompt_tokens: 3 },
      expected: { usagePresent: true, inputTokens: 3 },
    },
  ])(
    'preserves usage presence and explicit counts: $usage',
    async ({ usage, expected }) => {
      const result = await capture('openai-chat', frame({ usage }) + done)
      expect(result.last()).toEqual({
        ...expected,
        providerFinished: true,
        httpStatus: 200,
        bodyState: 'complete',
      })
    },
  )

  it('does not sum cumulative usage or invent missing fields', async () => {
    const result = await capture(
      'anthropic',
      frame({
        type: 'message_start',
        message: {
          usage: {
            input_tokens: 7,
            output_tokens: 0,
            cache_read_input_tokens: 20,
          },
        },
      }) +
        frame({
          type: 'message_delta',
          delta: { stop_reason: null },
          usage: { output_tokens: 2 },
        }) +
        frame({
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: { output_tokens: 5 },
        }) +
        frame({ type: 'message_stop' }),
    )
    expect(result.last()).toEqual({
      usagePresent: true,
      inputTokens: 7,
      cacheUsage: { readTokens: 20 },
      outputTokens: 5,
      providerFinished: true,
      finishReason: 'end_turn',
      httpStatus: 200,
      bodyState: 'complete',
    })
  })

  it('requires Anthropic message_stop rather than treating its stop reason as stream completion', async () => {
    const result = await capture(
      'anthropic',
      frame({
        type: 'message_delta',
        delta: { stop_reason: 'tool_use' },
        usage: { output_tokens: 4 },
      }),
    )
    expect(result.last()).toMatchObject({
      providerFinished: false,
      finishReason: 'tool_use',
      bodyState: 'incomplete',
      outputTokens: 4,
    })
  })

  it('observes Responses terminal envelopes and later usage without retaining content', async () => {
    const result = await capture(
      'openai-responses',
      frame({ type: 'response.output_text.delta', delta: 'Private answer' }) +
        frame({
          type: 'response.completed',
          response: {
            status: 'completed',
            output: 'Private answer',
            usage: { input_tokens: 9, output_tokens: 2, total_tokens: 11 },
          },
        }),
    )
    expect(result.last()).toEqual({
      usagePresent: true,
      inputTokens: 9,
      outputTokens: 2,
      totalTokens: 11,
      providerFinished: true,
      finishReason: 'completed',
      httpStatus: 200,
      bodyState: 'complete',
    })
    expect(JSON.stringify(result.attempts)).not.toContain('Private answer')
  })

  it('observes Gemini usage and finish reason without requiring an OpenAI DONE frame', async () => {
    const result = await capture(
      'gemini',
      frame({
        candidates: [
          { content: { parts: [{ text: '雪' }] }, finishReason: 'STOP' },
        ],
        usageMetadata: {
          promptTokenCount: 8,
          candidatesTokenCount: 2,
          totalTokenCount: 13,
          thoughtsTokenCount: 3,
          cachedContentTokenCount: 4,
        },
      }),
    )
    expect(result.last()).toEqual({
      usagePresent: true,
      inputTokens: 8,
      outputTokens: 2,
      totalTokens: 13,
      thinkingTokens: 3,
      cacheUsage: { readTokens: 4 },
      providerFinished: true,
      finishReason: 'STOP',
      httpStatus: 200,
      bodyState: 'complete',
    })
  })

  it.each([
    [
      'openai-chat',
      {
        choices: [{ finish_reason: 'tool_calls' }],
        usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
      },
      'tool_calls',
    ],
    [
      'openai-chat',
      {
        result: {
          response: 'Cloudflare response',
          usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
        },
        success: true,
      },
      undefined,
    ],
    [
      'openai-responses',
      {
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        usage: { input_tokens: 4, output_tokens: 1, total_tokens: 5 },
      },
      'max_output_tokens',
    ],
    [
      'anthropic',
      {
        type: 'message',
        stop_reason: 'end_turn',
        usage: { input_tokens: 4, output_tokens: 1 },
      },
      'end_turn',
    ],
    [
      'gemini',
      [
        {
          candidates: [{ finishReason: 'STOP' }],
          usageMetadata: {
            promptTokenCount: 4,
            candidatesTokenCount: 1,
            totalTokenCount: 5,
          },
        },
      ],
      'STOP',
    ],
  ] as const)('observes %s JSON responses', async (protocol, value, reason) => {
    const result = await capture(
      protocol,
      JSON.stringify(value),
      'application/json; charset=utf-8',
    )
    expect(result.last()).toMatchObject({
      inputTokens: 4,
      outputTokens: 1,
      providerFinished: true,
      bodyState: 'complete',
    })
    expect(result.last().finishReason).toBe(reason)
  })

  it('observes Groq usage in x_groq and filters arbitrary finish strings', async () => {
    const result = await capture(
      'openai-chat',
      frame({
        choices: [{ finish_reason: 'private-prompt' }],
        x_groq: {
          usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
          id: 'private-id',
        },
      }) + done,
    )
    expect(result.last()).toMatchObject({
      inputTokens: 4,
      outputTokens: 3,
      totalTokens: 7,
      providerFinished: true,
      bodyState: 'complete',
    })
    expect(result.last()).not.toHaveProperty('finishReason')
    expect(JSON.stringify(result.attempts)).not.toContain('private')
  })

  it('records absent terminal evidence even when the provider body reaches EOF normally', async () => {
    const result = await capture(
      'openai-chat',
      frame({
        choices: [
          { delta: { content: 'Partial answer' }, finish_reason: null },
        ],
        usage: { prompt_tokens: 2 },
      }),
    )
    expect(result.last()).toMatchObject({
      usagePresent: true,
      inputTokens: 2,
      providerFinished: false,
      bodyState: 'incomplete',
    })
  })

  it('marks a final SSE event without its delimiter incomplete', async () => {
    const result = await capture('openai-chat', done.trimEnd())
    expect(result.last()).toMatchObject({
      providerFinished: true,
      bodyState: 'incomplete',
    })
  })

  it('requires the chat DONE marker even after a finish reason and clean EOF', async () => {
    const result = await capture(
      'openai-chat',
      frame({
        choices: [{ finish_reason: 'tool_calls' }],
        usage: { prompt_tokens: 4 },
      }),
    )
    expect(result.last()).toEqual({
      usagePresent: true,
      inputTokens: 4,
      finishReason: 'tool_calls',
      providerFinished: false,
      httpStatus: 200,
      bodyState: 'incomplete',
    })
  })

  it('keeps valid partial counts and flags invalid values without converting them', async () => {
    const result = await capture(
      'openai-chat',
      frame({
        usage: {
          prompt_tokens: 5,
          completion_tokens: '2',
          total_tokens: -1,
          cost: 'secret',
        },
      }) +
        frame({ usage: { prompt_tokens: null, completion_tokens: 2.5 } }) +
        done,
    )
    expect(result.last()).toEqual({
      usagePresent: true,
      inputTokens: 5,
      usageInvalid: true,
      providerFinished: true,
      httpStatus: 200,
      bodyState: 'complete',
    })
    expect(JSON.stringify(result.attempts)).not.toContain('secret')
  })

  it('records upstream error bodies without copying headers, credentials, IDs or error text', async () => {
    const result = recorder()
    const raw = JSON.stringify({
      error: { message: 'secret-content', code: 'private-code' },
      usage: { prompt_tokens: 7 },
    })
    const response = await observeProviderFetch(
      'openai-chat',
      result.observer,
      async () =>
        new Response(raw, {
          status: 401,
          headers: {
            'content-type': 'application/json',
            'private-header': 'secret-header',
          },
        }),
    )('https://provider.invalid/?secret-url', {
      headers: { authorization: 'secret-token' },
    })
    expect(await response.text()).toBe(raw)
    expect(result.last()).toEqual({
      usagePresent: true,
      inputTokens: 7,
      providerFinished: true,
      finishReason: 'error',
      httpStatus: 401,
      bodyState: 'failed',
    })
    expect(JSON.stringify(result.attempts)).not.toMatch(/secret|private/)
  })

  it('forwards oversized SSE frames and resumes observation at the next actual event boundary', async () => {
    const raw =
      `data: ${'x'.repeat(270_000)}\ndata: ${JSON.stringify({ choices: [{ finish_reason: 'tool_calls' }], usage: { prompt_tokens: 900 } })}\n\n` +
      frame({ usage: { prompt_tokens: 3 } }) +
      done
    const result = await capture('openai-chat', raw)
    expect(result.last()).toEqual({
      usagePresent: true,
      inputTokens: 3,
      providerFinished: true,
      httpStatus: 200,
      bodyState: 'incomplete',
    })
    expect(
      result.attempts[0].snapshots.some(
        (value) =>
          value.inputTokens === 900 || value.finishReason === 'tool_calls',
      ),
    ).toBe(false)
  })

  it('forwards oversized JSON and unknown content types without asserting completion or usage', async () => {
    const large = await capture(
      'openai-chat',
      JSON.stringify({
        content: 'x'.repeat(1_050_000),
        usage: { prompt_tokens: 4 },
        choices: [{ finish_reason: 'stop' }],
      }),
      'application/json',
      16_384,
    )
    const unknown = await capture(
      'openai-chat',
      '<html>private failure</html>',
      'text/html',
    )
    for (const result of [large, unknown])
      expect(result.last()).toEqual({
        usagePresent: false,
        providerFinished: false,
        httpStatus: 200,
        bodyState: 'incomplete',
      })
  })

  it('forwards invalid UTF-8 unchanged without recording guessed metadata', async () => {
    const result = recorder()
    const bytes = Uint8Array.of(255, 254, 100, 97, 116, 97)
    const response = await observeProviderFetch(
      'openai-chat',
      result.observer,
      async () => responseBytes(bytes),
    )('https://provider.invalid/')
    expect(Buffer.from(await response.arrayBuffer()).equals(bytes)).toBe(true)
    expect(result.last()).toMatchObject({
      usagePresent: false,
      providerFinished: false,
      bodyState: 'incomplete',
    })
  })

  it('propagates consumer cancellation into the original stream, including a pending read', async () => {
    const result = recorder()
    const cancel = vi.fn()
    const response = await observeProviderFetch(
      'openai-chat',
      result.observer,
      async () =>
        new Response(new ReadableStream<Uint8Array>({ cancel }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    )('https://provider.invalid/')
    const reader = response.body!.getReader()
    const pending = reader.read()
    await reader.cancel('stop')
    expect(await pending).toEqual({ value: undefined, done: true })
    expect(cancel).toHaveBeenCalledExactlyOnceWith('stop')
    expect(result.last()).toMatchObject({
      bodyState: 'cancelled',
      usagePresent: false,
      providerFinished: false,
    })
  })

  it('preserves body failures and previously observed usage instead of reporting success', async () => {
    const result = recorder()
    const failure = new Error('private stream failure')
    let count = 0
    const response = await observeProviderFetch(
      'openai-chat',
      result.observer,
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              if (count++ === 0)
                controller.enqueue(
                  encoder.encode(frame({ usage: { prompt_tokens: 4 } })),
                )
              else controller.error(failure)
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    )('https://provider.invalid/')
    await expect(response.text()).rejects.toBe(failure)
    expect(result.last()).toMatchObject({
      bodyState: 'failed',
      usagePresent: true,
      inputTokens: 4,
      providerFinished: false,
    })
    expect(JSON.stringify(result.attempts)).not.toContain('private')
  })

  it('records dispatch errors and an aborted dispatch without leaking error messages', async () => {
    const error = new Error('private network error')
    for (const aborted of [false, true]) {
      const result = recorder()
      const controller = new AbortController()
      if (aborted) controller.abort()
      const observed = observeProviderFetch(
        'openai-chat',
        result.observer,
        async () => {
          throw error
        },
      )
      await expect(
        observed('https://provider.invalid/', { signal: controller.signal }),
      ).rejects.toBe(error)
      expect(result.last()).toEqual({
        usagePresent: false,
        providerFinished: false,
        bodyState: aborted ? 'cancelled' : 'failed',
      })
      expect(JSON.stringify(result.attempts)).not.toContain('private')
    }
  })

  it('does not prebuffer an unread body', async () => {
    const result = recorder()
    let pulls = 0
    const response = await observeProviderFetch(
      'openai-chat',
      result.observer,
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              pulls++
              controller.enqueue(encoder.encode(': heartbeat\n\n'))
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    )('https://provider.invalid/')
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(pulls).toBeLessThanOrEqual(2)
    expect(result.last().bodyState).toBe('pending')
    await response.body!.cancel()
  })

  it('lets an accounting-start failure prevent dispatch, but update failures never become fetch retries', async () => {
    const fetchImpl = vi.fn(async () => responseBytes(encoder.encode(done)))
    const failure = new Error('accounting unavailable')
    await expect(
      observeProviderFetch(
        'openai-chat',
        {
          start() {
            throw failure
          },
        },
        fetchImpl,
      )('https://provider.invalid/'),
    ).rejects.toBe(failure)
    expect(fetchImpl).not.toHaveBeenCalled()
    const response = await observeProviderFetch(
      'openai-chat',
      {
        start: () => ({
          update() {
            throw failure
          },
        }),
      },
      fetchImpl,
    )('https://provider.invalid/')
    expect(await response.text()).toBe(done)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('starts one observation per actual installed SDK dispatch, including an HTTP retry', async () => {
    const result = recorder()
    const success =
      frame({
        id: 'synthetic',
        model: 'synthetic',
        choices: [
          { index: 0, delta: { content: 'Hello' }, finish_reason: 'stop' },
        ],
      }) +
      frame({
        choices: [],
        usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
      }) +
      done
    const fetchImpl = vi.fn(async () =>
      fetchImpl.mock.calls.length === 1
        ? new Response(
            JSON.stringify({ error: { message: 'Synthetic retry' } }),
            {
              status: 503,
              headers: {
                'content-type': 'application/json',
                'retry-after-ms': '1',
              },
            },
          )
        : responseBytes(encoder.encode(success)),
    )
    const adapter = openaiCompatibleText('synthetic', {
      apiKey: 'synthetic',
      baseURL: 'https://provider.invalid/v1',
      fetch: observeProviderFetch('openai-chat', result.observer, fetchImpl),
      maxRetries: 1,
    })
    const events = []
    for await (const event of chat({
      adapter,
      messages: [{ role: 'user', content: 'Hello' }],
    }))
      events.push(event)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.attempts).toHaveLength(2)
    expect(result.attempts[0].snapshots.at(-1)).toMatchObject({
      httpStatus: 503,
      bodyState: 'cancelled',
    })
    expect(result.last()).toMatchObject({
      httpStatus: 200,
      bodyState: 'complete',
      inputTokens: 2,
      outputTokens: 1,
      totalTokens: 3,
    })
    expect(events.some((event) => event.type === 'RUN_FINISHED')).toBe(true)
  })

  it('wraps the actual Cloudflare binding boundary and preserves its methods, arguments, and raw output', async () => {
    const result = recorder()
    const inputs: unknown[][] = []
    const binding = {
      value: 'binding-private-field',
      describe() {
        return this.value
      },
      async run(...args: unknown[]) {
        expect(this).toBe(binding)
        inputs.push(args)
        return responseBytes(
          encoder.encode(
            frame({
              id: 'synthetic',
              choices: [
                {
                  index: 0,
                  delta: { content: 'Hello' },
                  finish_reason: 'stop',
                },
              ],
            }) +
              frame({
                response: '',
                usage: {
                  prompt_tokens: 5,
                  completion_tokens: 1,
                  total_tokens: 6,
                },
              }) +
              done,
          ),
        )
      },
    }
    const wrapped = observeProviderBinding(binding, result.observer)
    expect(wrapped.describe()).toBe(binding.value)
    const adapter = createCloudflareText('@cf/zai-org/glm-5.3-flash', {
      binding: wrapped as never,
    })
    for await (const _event of chat({
      adapter,
      messages: [{ role: 'user', content: 'Hello' }],
    })) {
      /* consume the real adapter */
    }
    expect(inputs).toHaveLength(1)
    expect(inputs[0][0]).toBe('@cf/zai-org/glm-5.3-flash')
    expect(inputs[0][2]).toMatchObject({ returnRawResponse: true })
    expect(result.last()).toMatchObject({
      bodyState: 'complete',
      inputTokens: 5,
      outputTokens: 1,
      totalTokens: 6,
    })
    expect(JSON.stringify(result.attempts)).not.toContain('private')
  })

  it('returns binding JSON object identity unchanged and records a thrown binding error', async () => {
    const result = recorder()
    const value = {
      response: 'private output',
      usage: { prompt_tokens: 3, completion_tokens: 0, total_tokens: 3 },
    }
    const binding = observeProviderBinding(
      {
        async run() {
          return value
        },
      },
      result.observer,
    )
    expect(await binding.run()).toBe(value)
    expect(result.last()).toMatchObject({
      bodyState: 'complete',
      inputTokens: 3,
      outputTokens: 0,
    })
    expect(result.last()).not.toHaveProperty('httpStatus')
    const failure = new Error('private binding failure')
    await expect(
      observeProviderBinding(
        {
          async run() {
            throw failure
          },
        },
        result.observer,
      ).run(),
    ).rejects.toBe(failure)
    expect(result.last().bodyState).toBe('failed')
    expect(JSON.stringify(result.attempts)).not.toContain('private')
  })

  it('does not require usage or invent a stop reason on a complete Workers AI JSON response', async () => {
    const result = recorder()
    const value = { response: 'Synthetic answer' }
    expect(
      await observeProviderBinding(
        {
          async run() {
            return value
          },
        },
        result.observer,
      ).run(),
    ).toBe(value)
    expect(result.last()).toEqual({
      usagePresent: false,
      providerFinished: true,
      bodyState: 'complete',
    })
  })
})

it.each(['openai-chat', 'openai-responses'] as const)(
  'preserves %s cache counts including zero',
  async (protocol) => {
    const usage =
      protocol === 'openai-chat'
        ? {
            prompt_tokens: 100,
            completion_tokens: 2,
            prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 50 },
          }
        : {
            input_tokens: 100,
            output_tokens: 2,
            input_tokens_details: { cached_tokens: 0, cache_write_tokens: 50 },
          }
    const result = await capture(protocol, frame({ usage }) + done)
    expect(result.last().cacheUsage).toEqual({ readTokens: 0, writeTokens: 50 })
  },
)
it('preserves Anthropic cache tiers without summing overlapping categories', async () => {
  const result = await capture(
    'anthropic',
    frame({
      usage: {
        input_tokens: 7,
        cache_creation_input_tokens: 30,
        cache_read_input_tokens: 20,
        cache_creation: {
          ephemeral_5m_input_tokens: 10,
          ephemeral_1h_input_tokens: 20,
        },
      },
    }),
  )
  expect(result.last().cacheUsage).toEqual({
    readTokens: 20,
    writeTokens: 30,
    write5mTokens: 10,
    write1hTokens: 20,
  })
})
it.each([-1, 1.5, null, '20'])(
  'rejects invalid cache count %s',
  async (count) => {
    const result = await capture(
      'openai-chat',
      frame({ usage: { prompt_tokens_details: { cached_tokens: count } } }) +
        done,
    )
    expect(result.last().usageInvalid).toBe(true)
    expect(result.last().cacheUsage).toBeUndefined()
  },
)

it('omits diagnostics for a Request body without consuming or replacing the request', async () => {
  const start = vi.fn(() => ({ update: () => {} }))
  const input = new Request('https://provider.invalid', {
    method: 'POST',
    body: JSON.stringify({ messages: [{ role: 'user', content: 'private' }] }),
  })
  const transport = vi.fn(
    async (actual: RequestInfo | URL, init?: RequestInit) => {
      expect(actual).toBe(input)
      expect(init).toBeUndefined()
      expect(input.bodyUsed).toBe(false)
      expect(await input.json()).toHaveProperty('messages')
      return new Response('{}', {
        headers: { 'content-type': 'application/json' },
      })
    },
  )
  const observed = observeProviderFetch('openai-chat', { start }, transport)
  await (await observed(input)).text()
  expect(start).toHaveBeenCalledWith('openai-chat', undefined)
  expect(transport).toHaveBeenCalledTimes(1)
})
