import assert from 'node:assert/strict'
import test from 'node:test'
import { chat, toolDefinition, type StreamChunk } from '@tanstack/ai'
import { memoryStorage } from '@tanstack/ai-client/byok'
import { createOpenRouterText } from '@tanstack/ai-openrouter'
import { createS256CodeChallenge } from '@tanstack/ai-openrouter/pkce'
import { z } from 'zod'
import {
  startBuilderOpenRouterLogin,
  isOpenRouterCallback,
} from '../src/utils/builder-openrouter-login.client'
import { openRouterCallbackResponse } from '../src/routes/api/builder/openrouter/callback'
import { createBuilderAiByokConnection } from '../src/utils/builder-ai-api-key-storage.client'
import { streamBuilderAiResponse } from '../src/utils/builder-ai'
import { createExampleWorkspace } from '../src/utils/example-workspace'

test('OpenRouter callback accepts only the current attempt and a bounded code', () => {
  assert.equal(
    isOpenRouterCallback({ state: 'one', code: 'code' }, 'one'),
    true,
  )
  assert.equal(
    isOpenRouterCallback({ state: 'two', code: 'code' }, 'one'),
    false,
  )
  assert.equal(isOpenRouterCallback({ state: 'one', code: null }, 'one'), true)
  for (const code of ['', 'x'.repeat(4097), {}, 1]) {
    assert.equal(isOpenRouterCallback({ state: 'one', code }, 'one'), false)
  }
})

test('OpenRouter callback removes credentials from history and loads no app or external resources', async () => {
  const response = openRouterCallbackResponse()
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.match(
    response.headers.get('content-security-policy') ?? '',
    /default-src 'none'/,
  )
  const html = await response.text()
  assert.match(html, /history.replaceState/)
  assert.match(html, /BroadcastChannel/)
  assert.doesNotMatch(
    html,
    /<script[^>]+src=|window.opener|localStorage|sessionStorage/,
  )
})

test('OpenRouter login exchanges a tab callback with S256 and never persists the verifier', async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const oldFetch = globalThis.fetch
  let navigate: (url: URL) => void = () => {}
  const navigated = new Promise<URL>((resolve) => {
    navigate = resolve
  })
  let closed = false
  const popup = {
    opener: {},
    close() {
      closed = true
    },
    location: {
      replace(url: string) {
        navigate(new URL(url))
      },
    },
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      isSecureContext: true,
      location: { origin: 'https://builder.test' },
      open: () => popup,
      setTimeout,
      clearTimeout,
    },
  })
  const controller = new AbortController()
  let channel: BroadcastChannel | undefined
  try {
    let exchangeCount = 0
    globalThis.fetch = async (input, init) => {
      assert.equal(input, 'https://openrouter.ai/api/v1/auth/keys')
      const body = z
        .object({
          code: z.string(),
          code_verifier: z.string(),
          code_challenge_method: z.literal('S256'),
        })
        .parse(JSON.parse(String(init?.body)))
      assert.equal(body.code, 'authorized-code')
      assert.equal(
        await createS256CodeChallenge(body.code_verifier),
        auth.searchParams.get('code_challenge'),
      )
      assert.equal(init?.credentials, 'omit')
      exchangeCount++
      return Response.json({ key: 'openrouter-test-key' })
    }
    const result = startBuilderOpenRouterLogin(controller.signal)
    const auth = await navigated
    assert.equal(auth.origin, 'https://openrouter.ai')
    assert.equal(auth.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(popup.opener, null)
    const callback = new URL(auth.searchParams.get('callback_url') ?? '')
    assert.equal(callback.origin, 'https://builder.test')
    const state = callback.searchParams.get('state')
    channel = new BroadcastChannel(`builder-openrouter:${state}`)
    channel.postMessage({ state: 'wrong', code: 'bad-code' })
    channel.postMessage({ state, code: 'authorized-code' })
    channel.postMessage({ state, code: 'authorized-code' })
    assert.equal(await result, 'openrouter-test-key')
    assert.equal(exchangeCount, 1)
    assert.equal(closed, true)

    const cancelled = startBuilderOpenRouterLogin(controller.signal)
    controller.abort()
    await assert.rejects(cancelled, { name: 'AbortError' })
  } finally {
    controller.abort()
    channel?.close()
    globalThis.fetch = oldFetch
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('OpenRouter credentials use the existing scoped BYOK storage and header', async () => {
  const connection = createBuilderAiByokConnection({
    scope: 'one',
    storage: memoryStorage(),
  })
  const other = createBuilderAiByokConnection({
    scope: 'two',
    storage: memoryStorage(),
  })
  await connection.save('openrouter', 'openrouter-test-key')
  assert.equal(connection.hasConfiguredKey('openrouter'), true)
  assert.equal(other.hasConfiguredKey('openrouter'), false)
  assert.equal(
    connection
      .getClient('openrouter', { allowUnlock: false })
      ?.headers('openrouter')['x-byok-openrouter'],
    'openrouter-test-key',
  )
  await connection.clear('openrouter')
  assert.equal(connection.hasConfiguredKey('openrouter'), false)
})

test('OpenRouter runs server tools through the Builder stream without a partial execution result', async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<Record<string, unknown>> = []
  const headers: Array<Headers> = []
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    headers.push(request.headers)
    requests.push(await request.json())
    const first = requests.length === 1
    const chunks = [
      {
        id: 'chat-1',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'openai/gpt-5.6-luna',
        choices: [
          {
            index: 0,
            delta: first
              ? {
                  role: 'assistant',
                  tool_calls: [
                    {
                      index: 0,
                      id: 'tool-1',
                      type: 'function',
                      function: { name: 'read_file', arguments: '{}' },
                    },
                  ],
                }
              : { role: 'assistant', content: 'Read the file.' },
            finish_reason: null,
          },
        ],
      },
      {
        id: 'chat-1',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'openai/gpt-5.6-luna',
        choices: [
          { index: 0, delta: {}, finish_reason: first ? 'tool_calls' : 'stop' },
        ],
      },
    ]
    return new Response(
      chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
        'data: [DONE]\n\n',
      { headers: { 'content-type': 'text/event-stream' } },
    )
  }
  try {
    const read = toolDefinition({
      name: 'read_file',
      description: 'Read the file',
      inputSchema: z.object({}),
      outputSchema: z.string(),
    }).server(() => 'file content')
    const stream = chat({
      adapter: createOpenRouterText('openai/gpt-5.6-luna', 'test-key', {
        httpReferer: 'https://tanstack.com/builder',
        appTitle: 'TanStack Builder',
      }),
      messages: [{ role: 'user', content: 'Read the file' }],
      tools: [read],
      modelOptions: {
        maxCompletionTokens: 8000,
        provider: { requireParameters: true },
      },
    })
    const chunks: Array<StreamChunk> = []
    for await (const chunk of streamBuilderAiResponse(
      stream,
      'test-key',
      (message) => ({
        message,
        execution: {
          runtime: null,
          workspace: createExampleWorkspace({
            entry: '/index.tsx',
            files: { '/index.tsx': 'export default 1' },
          }),
        },
        changedFiles: [],
        runtimeChanged: false,
        trace: { evidenceFingerprints: [], mutationFingerprints: [] },
      }),
    ))
      chunks.push(chunk)
    assert.equal(requests.length, 2)
    assert.equal(headers[0]?.get('authorization'), 'Bearer test-key')
    assert.equal(
      headers[0]?.get('http-referer'),
      'https://tanstack.com/builder',
    )
    assert.equal(headers[0]?.get('x-openrouter-title'), 'TanStack Builder')
    assert.equal(
      chunks.some((chunk) => chunk.type === 'RUN_ERROR'),
      false,
      JSON.stringify(chunks),
    )
    assert.equal(
      chunks.filter(
        (chunk) =>
          chunk.type === 'CUSTOM' && chunk.name === 'builder.project.execution',
      ).length,
      1,
    )
    assert.match(JSON.stringify(requests[1]?.messages), /file content/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
