import assert from 'node:assert/strict'
import test from 'node:test'
import { chat, toolDefinition, type StreamChunk } from '@tanstack/ai'
import { createOpenaiChat } from '@tanstack/ai-openai'
import { z } from 'zod'

type ResponseStreamEvent = Record<string, unknown>

function toEventStream(events: Array<ResponseStreamEvent>) {
  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`
}

test('Responses reasoning survives sequential server tool iterations through previous_response_id', async () => {
  const reasoningItem = {
    type: 'reasoning',
    id: 'rs_reasoning_1',
    summary: [],
    encrypted_content: 'encrypted-reasoning-must-stay-provider-side',
  }
  const functionCallItem = {
    type: 'function_call',
    id: 'fc_item_1',
    call_id: 'call_1',
    name: 'read_file',
    arguments: '{"path":"/index.tsx"}',
  }
  const secondReasoningItem = {
    type: 'reasoning',
    id: 'rs_reasoning_2',
    summary: [],
    encrypted_content: 'second-encrypted-reasoning-must-stay-provider-side',
  }
  const secondFunctionCallItem = {
    type: 'function_call',
    id: 'fc_item_2',
    call_id: 'call_2',
    name: 'read_file',
    arguments: '{"path":"/styles.css"}',
  }
  const turns: Array<Array<ResponseStreamEvent>> = [
    [
      {
        type: 'response.created',
        response: {
          id: 'resp_1',
          model: 'gpt-5.6-sol',
          status: 'in_progress',
        },
      },
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: reasoningItem,
      },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: reasoningItem,
      },
      {
        type: 'response.output_item.added',
        output_index: 1,
        item: { ...functionCallItem, arguments: '' },
      },
      {
        type: 'response.function_call_arguments.done',
        item_id: 'fc_item_1',
        output_index: 1,
        arguments: functionCallItem.arguments,
      },
      {
        type: 'response.output_item.done',
        output_index: 1,
        item: functionCallItem,
      },
      {
        type: 'response.completed',
        response: {
          id: 'resp_1',
          model: 'gpt-5.6-sol',
          status: 'completed',
          output: [reasoningItem, functionCallItem],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        },
      },
    ],
    [
      {
        type: 'response.created',
        response: {
          id: 'resp_2',
          model: 'gpt-5.6-sol',
          status: 'in_progress',
        },
      },
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: secondReasoningItem,
      },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: secondReasoningItem,
      },
      {
        type: 'response.output_item.added',
        output_index: 1,
        item: { ...secondFunctionCallItem, arguments: '' },
      },
      {
        type: 'response.function_call_arguments.done',
        item_id: 'fc_item_2',
        output_index: 1,
        arguments: secondFunctionCallItem.arguments,
      },
      {
        type: 'response.output_item.done',
        output_index: 1,
        item: secondFunctionCallItem,
      },
      {
        type: 'response.completed',
        response: {
          id: 'resp_2',
          model: 'gpt-5.6-sol',
          status: 'completed',
          output: [secondReasoningItem, secondFunctionCallItem],
          usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 },
        },
      },
    ],
    [
      {
        type: 'response.created',
        response: {
          id: 'resp_3',
          model: 'gpt-5.6-sol',
          status: 'in_progress',
        },
      },
      {
        type: 'response.output_text.delta',
        item_id: 'msg_1',
        output_index: 0,
        content_index: 0,
        delta: 'Done',
      },
      {
        type: 'response.completed',
        response: {
          id: 'resp_3',
          model: 'gpt-5.6-sol',
          status: 'completed',
          output: [],
          usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 },
        },
      },
    ],
  ]
  const requests: Array<Record<string, unknown>> = []
  const fakeFetch: typeof fetch = async (_input, init) => {
    const body = init?.body
    if (typeof body !== 'string') {
      throw new Error('Responses request body must be JSON')
    }
    requests.push(JSON.parse(body))
    const events = turns.shift()
    if (!events) throw new Error('unexpected extra Responses API request')
    return new Response(toEventStream(events), {
      headers: { 'content-type': 'text/event-stream' },
    })
  }
  const readFile = toolDefinition({
    name: 'read_file',
    description: 'Read a file.',
    inputSchema: z.object({ path: z.string() }),
  }).server(({ path }) => ({
    path,
    content: path === '/index.tsx' ? 'export default 1' : 'body {}',
  }))

  const chunks: Array<StreamChunk> = []
  for await (const chunk of chat({
    adapter: createOpenaiChat('gpt-5.6-sol', 'test-key', {
      fetch: fakeFetch,
    }),
    messages: [{ role: 'user', content: 'Read the entry file.' }],
    tools: [readFile],
  })) {
    chunks.push(chunk)
  }

  assert.equal(requests.length, 3)
  assert.equal(requests[1]?.previous_response_id, 'resp_1')
  assert.deepEqual(requests[1]?.input, [
    {
      type: 'function_call_output',
      call_id: 'call_1',
      output: JSON.stringify({
        path: '/index.tsx',
        content: 'export default 1',
      }),
    },
  ])
  assert.equal(requests[2]?.previous_response_id, 'resp_2')
  assert.deepEqual(requests[2]?.input, [
    {
      type: 'function_call_output',
      call_id: 'call_2',
      output: JSON.stringify({ path: '/styles.css', content: 'body {}' }),
    },
  ])

  const serializedChunks = JSON.stringify(chunks)
  assert.doesNotMatch(serializedChunks, /rs_reasoning_[12]/)
  assert.doesNotMatch(
    serializedChunks,
    /encrypted-reasoning-must-stay-provider-side/,
  )
})
