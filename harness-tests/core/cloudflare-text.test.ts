import { chat, maxIterations, toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import { expect, it, vi } from 'vitest'
import { createGumCloudflareText } from '../../src/chat/server/cloudflare-text'

it.each([
  ['@cf/moonshotai/kimi-k2.6', false],
  ['@cf/moonshotai/kimi-k2.5', true],
  ['@cf/openai/gpt-oss-120b', true],
])(
  'sends the reviewed strictness for %s without changing schema or content',
  async (model, strict) => {
    const content = '# Plan\n- Alpha\n- Beta'
    const execute = vi.fn(async (input: { content: string }) => input)
    const tool = toolDefinition({
      name: 'save_text',
      description: 'Save text.',
      inputSchema: z.object({ content: z.string().min(1) }).strict(),
    }).server(execute)
    const run = vi.fn(async (_model, input) => {
      expect(input.tools[0].function.strict).toBe(strict)
      expect(input.tools[0].function.parameters).toMatchObject({
        required: ['content'],
        additionalProperties: false,
        properties: { content: { type: 'string', minLength: 1 } },
      })
      return new Response(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name: 'save_text', arguments: JSON.stringify({ content }) } }] }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`,
        { headers: { 'content-type': 'text/event-stream' } },
      )
    })
    for await (const _ of chat({
      adapter: createGumCloudflareText(model, { binding: { run } as never }),
      messages: [{ role: 'user', content: 'Save text' }],
      tools: [tool],
      agentLoopStrategy: maxIterations(1),
    })) {
      /* consume the actual adapter and tool loop */
    }
    expect(run).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0][0]).toEqual({ content })
  },
)

it.each(['binding', 'rest'] as const)(
  'rejects malformed arguments before execution over %s without strict generation',
  async (transport) => {
    const execute = vi.fn(async (input: { content: string }) => input)
    const tool = toolDefinition({
      name: 'save_text',
      description: 'Save text.',
      inputSchema: z.object({ content: z.string().min(1) }).strict(),
    }).server(execute)
    const requests: any[] = []
    const response = (input: any) => {
      requests.push(input)
      return new Response(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'invalid-call', type: 'function', function: { name: 'save_text', arguments: JSON.stringify({ content: 42, workspaceId: 'untrusted-authority' }) } }] }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`,
        { headers: { 'content-type': 'text/event-stream' } },
      )
    }
    const adapter = createGumCloudflareText(
      '@cf/moonshotai/kimi-k2.6',
      transport === 'binding'
        ? {
            binding: {
              run: async (_model: string, input: unknown) => response(input),
            } as never,
          }
        : {
            accountId: 'synthetic-account',
            apiKey: 'synthetic-key',
            maxRetries: 0,
            fetch: async (_url, init) =>
              response(JSON.parse(String(init?.body))),
          },
    )
    const events: any[] = []
    for await (const event of chat({
      adapter,
      messages: [{ role: 'user', content: 'Save text' }],
      tools: [tool],
      agentLoopStrategy: maxIterations(1),
    }))
      events.push(event)
    expect(requests).toHaveLength(1)
    expect(requests[0].tools[0].function.strict).toBe(false)
    expect(execute).not.toHaveBeenCalled()
    expect(
      events.some(
        (event) =>
          event.type === 'TOOL_CALL_END' || event.type === 'TOOL_CALL_RESULT',
      ),
    ).toBe(true)
  },
)
