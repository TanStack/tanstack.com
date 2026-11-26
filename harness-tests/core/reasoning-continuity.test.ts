import { afterEach, expect, it, vi } from 'vitest'
import {
  chat,
  maxIterations,
  StreamProcessor,
  toolDefinition,
  type UIMessage,
} from '@tanstack/ai'
import { createOpenaiChat } from '@tanstack/ai-openai'
import { z } from 'zod'
import { projectBranchContext } from '../../src/chat/core/conversation-copy'
import { assistantContextMiddlewares } from '../../src/chat/server/assistant-context'

afterEach(() => vi.unstubAllGlobals())
const reasoning = {
  type: 'reasoning',
  id: 'rs_synthetic',
  encrypted_content: 'synthetic-opaque-value',
  summary: [],
}
const call = {
  type: 'function_call',
  id: 'fc_synthetic',
  call_id: 'call_synthetic',
  name: 'read_value',
  arguments: '{}',
}
const message = {
  type: 'message',
  id: 'msg_synthetic',
  role: 'assistant',
  content: [{ type: 'output_text', text: 'Done.', annotations: [] }],
}
function response(output: unknown[]) {
  const event = (type: string, value: unknown) =>
    `event: ${type}\ndata: ${JSON.stringify({ type, ...(value as object) })}\n\n`
  return new Response(
    output
      .map((item, output_index) =>
        event('response.output_item.done', { item, output_index }),
      )
      .join('') +
      event('response.completed', {
        response: {
          id: 'resp_synthetic',
          model: 'gpt-5',
          status: 'completed',
          output,
          usage: { input_tokens: 20, output_tokens: 5, total_tokens: 25 },
        },
      }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
}
it.each([false, true])(
  'replays opaque reasoning through serialization and context projection, compaction=%s',
  async (compact) => {
    const requests: any[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        requests.push(JSON.parse(init.body))
        return response(requests.length === 1 ? [reasoning, call] : [message])
      }),
    )
    const tools = [
      toolDefinition({
        name: 'read_value',
        description: 'Read a synthetic value.',
        inputSchema: z.object({}),
      }).server(() => ({ value: 42 })),
    ]
    const initial: UIMessage[] = [
      ...(compact
        ? [
            {
              id: 'older-user',
              role: 'user' as const,
              parts: [
                {
                  type: 'text' as const,
                  content: 'Earlier request. '.repeat(12000),
                },
              ],
            },
            {
              id: 'older-answer',
              role: 'assistant' as const,
              parts: [{ type: 'text' as const, content: 'Earlier answer.' }],
            },
          ]
        : []),
      {
        id: 'user',
        role: 'user',
        parts: [{ type: 'text', content: 'Read the value.' }],
      },
    ]
    const processor = new StreamProcessor({ initialMessages: initial })
    for await (const chunk of chat({
      adapter: createOpenaiChat('gpt-5', 'synthetic-key'),
      messages: initial,
      tools,
      agentLoopStrategy: maxIterations(1),
    }))
      processor.processChunk(chunk)
    const restored: UIMessage[] = JSON.parse(
      JSON.stringify(processor.getMessages()),
    )
    const saved = new Map<string, unknown>()
    const middleware = assistantContextMiddlewares({
      put: async (id, value) => {
        saved.set(id, value)
      },
      get: async (id) => saved.get(id),
    })
    for await (const _chunk of chat({
      adapter: createOpenaiChat('gpt-5', 'synthetic-key'),
      messages: projectBranchContext(restored),
      tools,
      middleware: [middleware.context, middleware.observation],
      agentLoopStrategy: maxIterations(1),
    })) {
      /* drain */
    }
    if (compact) expect(saved.size).toBeGreaterThan(0)
    expect(requests).toHaveLength(2)
    expect(requests[0].include).toContain('reasoning.encrypted_content')
    const input = requests[1].input
    const at = input.findIndex((item: any) => item.type === 'reasoning')
    expect(at).toBeGreaterThanOrEqual(0)
    expect(input[at]).toMatchObject(reasoning)
    expect(input.slice(at + 1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_synthetic',
        }),
        expect.objectContaining({
          type: 'function_call_output',
          call_id: 'call_synthetic',
        }),
      ]),
    )
  },
)
