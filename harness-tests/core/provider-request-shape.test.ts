import { expect, it } from 'vitest'
import {
  bindingRequestShape,
  fetchRequestShape,
} from '../../src/chat/server/provider-request-shape'
it('records bounded structure without copying content or names', () => {
  const payload = {
    messages: [
      { role: 'system', content: 'private system text' },
      { role: 'user', content: 'private request' },
      { role: 'assistant', content: 'private response' },
      { role: 'tool', content: 'secret tool result', name: 'private_tool' },
    ],
    tools: [
      { function: { name: 'private_tool', description: 'private schema' } },
    ],
  }
  const original = JSON.stringify(payload)
  const result = bindingRequestShape(payload)
  expect(result).toEqual({
    version: 1,
    boundary: 'cloudflare-binding',
    messageCount: 4,
    toolCount: 1,
    tailRoles: ['system', 'user', 'assistant', 'tool'],
    lastUserIndex: 1,
    lastUserTextCharacters: 15,
  })
  expect(JSON.stringify(result)).not.toMatch(/private|secret/)
  expect(JSON.stringify(payload)).toBe(original)
})
it('does not infer text lengths for multimodal messages or retain arbitrary role strings', () => {
  expect(
    bindingRequestShape({
      messages: [
        { role: 'private-name', content: 'secret' },
        { role: 'user', content: [{ type: 'image', url: 'secret' }] },
      ],
    }),
  ).toMatchObject({ tailRoles: ['unknown', 'user'], lastUserIndex: 1 })
  expect(
    bindingRequestShape({ messages: [{ role: 'user', content: [] }] }),
  ).not.toHaveProperty('lastUserTextCharacters')
  expect(
    bindingRequestShape({
      messages: Array.from({ length: 100 }, () => ({ role: 'assistant' })),
    })!.tailRoles,
  ).toHaveLength(16)
  expect(bindingRequestShape({ messages: Array(4097) })).toBeUndefined()
  expect(bindingRequestShape({ messages: 'secret' })).toBeUndefined()
  expect(
    bindingRequestShape({ messages: [], tools: 'invalid' }),
  ).toBeUndefined()
})

it('observes provider field sizes and fixed kinds without retaining JSON content', () => {
  const raw = JSON.stringify(
    {
      input: [
        { role: 'user', content: 'private request 🌲' },
        { type: 'reasoning', encrypted_content: 'secret opaque item' },
        {
          type: 'function_call',
          name: 'private_tool',
          arguments: '{"secret":true}',
        },
        { type: 'function_call_output', output: 'private result' },
        { type: 'private-arbitrary-kind' },
      ],
      instructions: 'private instructions',
      tools: [{ type: 'function', name: 'private_tool' }],
    },
    null,
    2,
  )
  const result = fetchRequestShape('openai-responses', raw)!
  expect(result).toMatchObject({
    version: 2,
    boundary: 'provider-fetch',
    protocol: 'openai-responses',
    inputItemCount: 5,
    toolEntryCount: 1,
    tailKinds: [
      'user',
      'reasoning',
      'function_call',
      'function_call_output',
      'unknown',
    ],
    requestBytes: new TextEncoder().encode(raw).length,
    instructionBytes: new TextEncoder().encode(
      JSON.stringify('private instructions'),
    ).length,
  })
  expect(JSON.stringify(result)).not.toMatch(/private|secret|opaque/)
  expect(result.requestBytes).toBeGreaterThan(
    result.inputBytes + result.toolBytes,
  )
})
it('counts Gemini tool groups rather than pretending they are individual functions', () => {
  expect(
    fetchRequestShape(
      'gemini',
      JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: 'secret' }] },
          { role: 'model', parts: [] },
        ],
        systemInstruction: { parts: [{ text: 'private' }] },
        tools: [{ functionDeclarations: [{ name: 'one' }, { name: 'two' }] }],
      }),
    ),
  ).toMatchObject({
    inputItemCount: 2,
    toolEntryCount: 1,
    tailKinds: ['user', 'model'],
  })
  expect(
    fetchRequestShape(
      'anthropic',
      JSON.stringify({
        messages: [{ role: 'user', content: [] }],
        system: [{ type: 'text', text: 'secret' }],
      }),
    ),
  ).toMatchObject({ toolEntryCount: 0, toolBytes: 0, inputItemCount: 1 })
  expect(
    fetchRequestShape('openai-responses', JSON.stringify({ input: 'hello' })),
  ).toMatchObject({ inputItemCount: 1, tailKinds: ['user'] })
})
it('omits unsupported or oversized request diagnostics without reading streams', () => {
  for (const body of [
    undefined,
    '{}',
    '{broken',
    JSON.stringify({ messages: [], tools: {} }),
    JSON.stringify({ messages: Array(4097) }),
    ' '.repeat(1024 * 1024 + 1),
  ])
    expect(fetchRequestShape('openai-chat', body)).toBeUndefined()
  const stream = new ReadableStream({ start() {} })
  expect(fetchRequestShape('openai-chat', stream)).toBeUndefined()
  expect(stream.locked).toBe(false)
  expect(
    fetchRequestShape(
      'openai-chat',
      JSON.stringify({ messages: Array(30).fill({ role: 'assistant' }) }),
    )?.tailKinds,
  ).toHaveLength(16)
})
