import type { ConversationEnvironment } from '../../src/chat/server/conversation-environment'
import { chat, maxIterations } from '@tanstack/ai'
import { expect, it, vi } from 'vitest'
import { connectionSchema } from '../../src/chat/core/types'
import { assistantReferenceTools } from '../../src/chat/server/message-references'
import { assistantContextMiddlewares } from '../../src/chat/server/assistant-context'
import { adapterFor } from '../../src/chat/server/providers'
import { conversationHarness } from './fixtures/conversation-runtime'
import type { ContextObservation } from '../../src/chat/core/context-observation'

function response(pass: number, call?: { name: string; args: unknown }) {
  const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`
  return new Response(
    frame({
      id: `response-${pass}`,
      choices: [
        {
          index: 0,
          delta: call
            ? {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id: `call-${pass}`,
                    type: 'function',
                    function: {
                      name: call.name,
                      arguments: JSON.stringify(call.args),
                    },
                  },
                ],
              }
            : { role: 'assistant', content: 'Both pages were read.' },
          finish_reason: null,
        },
      ],
    }) +
      frame({
        choices: [
          { index: 0, delta: {}, finish_reason: call ? 'tool_calls' : 'stop' },
        ],
      }) +
      'data: [DONE]\n\n',
    {
      headers: { 'content-type': 'text/event-stream' },
    },
  )
}

it('carries a fresh 16000-character page and its exact cursor through production context middleware into the next model request', async () => {
  const content = 'Source handoff detail. '.repeat(850) + 'Final marker.'
  const h = await conversationHarness({
    messages: [
      { id: 'source', role: 'user', parts: [{ type: 'text', content }] },
    ],
  })
  await h.db`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES('requester','b',${'00000000-0000-4000-8000-000000000001'})`
  const source = { botId: 'b', conversationId: 'main-conversation' }
  const sourceReads = vi.spyOn(h.c, 'referenceContext')
  Object.assign(h.env.CONVERSATIONS, {
    getByName: (id: string) => {
      expect(id).toBe(source.conversationId)
      return h.c
    },
  })
  const tools = assistantReferenceTools({
    env: {
      ...h.env,
      CONVERSATIONS: {
        getByName: (id: string) => {
          if (id !== source.conversationId) throw new Error('Unexpected source')
          return h.c
        },
      },
    },
    scope: {
      workspaceId: 'w',
      userId: '00000000-0000-4000-8000-000000000001',
      botId: 'b',
      conversationId: 'requester',
    },
    references: [{ kind: 'conversation', ...source, label: 'Handoff' }],
  })
  const stored = new Map<string, unknown>()
  const observations: ContextObservation[] = []
  const middleware = assistantContextMiddlewares(
    {
      put: async (id, value) => {
        stored.set(id, value)
      },
      get: async (id) => stored.get(id),
    },
    {
      scope: { transcriptEpoch: 'requester-epoch', runId: 'requester-run' },
      assertCurrent: () => {},
      record: (value) => {
        observations.push(value)
      },
    },
  )
  const seen: any[] = []
  let nextPage: string | undefined
  const run = vi.fn(async (_model: string, payload: any) => {
    const pass = seen.length
    seen.push(structuredClone(payload))
    if (pass === 0)
      return response(pass, {
        name: 'read_conversation',
        args: { conversationId: source.conversationId },
      })
    const lastTool = payload.messages
      .filter((message: any) => message.role === 'tool')
      .at(-1)
    const page = JSON.parse(lastTool.content)
    expect(page.ok).toBe(true)
    expect(page.archivedMessage).toBeUndefined()
    if (pass === 1) {
      expect(Array.from(page.text)).toHaveLength(16000)
      expect(page.text).toBe(('user: ' + content).slice(0, 16000))
      expect(page.nextPage).toBeTypeOf('string')
      nextPage = page.nextPage
      // The call is based solely on what reached the provider, not a test-side
      // result list that could hide a context projection bug.
      return response(pass, {
        name: 'continue_conversation',
        args: { cursor: page.nextPage },
      })
    }
    expect(pass).toBe(2)
    expect(page.text).toBe(('user: ' + content).slice(16000))
    expect(page.nextPage).toBeUndefined()
    return response(pass)
  })
  const network = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(Error('External requests are forbidden.'))
  try {
    const env = { ...h.env, AI: { run } } as unknown as ConversationEnvironment
    const events = []
    for await (const event of chat({
      adapter: adapterFor(
        connectionSchema.parse({
          provider: 'included',
          model: env.INCLUDED_MODEL,
        }),
        env,
      )!,
      messages: [
        { role: 'user', content: 'Read both pages of the selected handoff.' },
      ],
      tools,
      middleware: [middleware.context, middleware.observation],
      agentLoopStrategy: maxIterations(4),
    }))
      events.push(event)
    expect(events.filter((event) => event.type === 'RUN_ERROR')).toEqual([])
    expect(run).toHaveBeenCalledTimes(3)
    expect(sourceReads).toHaveBeenCalledTimes(2)
    expect(sourceReads.mock.calls[1][1]).toMatchObject({
      offset: 16000,
      expectedEpoch: expect.any(String),
      revision: expect.any(String),
    })
    expect(observations[1].history.archivedLargeMessages).toBe(0)
    expect(observations[2].history.archivedLargeMessages).toBe(1)
    expect(JSON.stringify([...stored.values()])).toContain(nextPage!)
    expect(network).not.toHaveBeenCalled()
  } finally {
    network.mockRestore()
  }
})

it('keeps a restored completed exchange through init projection and an actual SDK retry', async () => {
  const h = await conversationHarness()
  const content = JSON.stringify({
    outcome: 'succeeded',
    evidence: 'Restored action evidence. '.repeat(700),
  })
  const stored = new Map<string, unknown>()
  const observations: ContextObservation[] = []
  const middleware = assistantContextMiddlewares(
    {
      put: async (id, value) => {
        stored.set(id, value)
      },
      get: async (id) => stored.get(id),
    },
    {
      scope: { transcriptEpoch: 'epoch', runId: 'resumed-run' },
      assertCurrent: () => {},
      record: (value) => {
        observations.push(value)
      },
    },
  )
  const requests: unknown[] = []
  const run = vi.fn(async (_model: string, payload: any) => {
    requests.push(structuredClone(payload))
    expect(
      payload.messages.find((message: any) => message.role === 'tool').content,
    ).toBe(content)
    if (requests.length === 1)
      throw new Error('Synthetic transient transport error.')
    return response(0)
  })
  const network = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(Error('External requests are forbidden.'))
  try {
    const env = { ...h.env, AI: { run } } as unknown as ConversationEnvironment
    for await (const _ of chat({
      adapter: adapterFor(
        connectionSchema.parse({
          provider: 'included',
          model: env.INCLUDED_MODEL,
        }),
        env,
      )!,
      messages: [
        { role: 'user', content: 'Continue after the approved action.' },
        {
          role: 'assistant',
          content: null,
          toolCalls: [
            {
              id: 'restored-call',
              type: 'function',
              function: { name: 'generic_action', arguments: '{}' },
            },
          ],
        },
        { role: 'tool', toolCallId: 'restored-call', content },
      ],
      middleware: [middleware.context, middleware.observation],
      agentLoopStrategy: maxIterations(1),
    })) {
    }
    expect(run).toHaveBeenCalledTimes(2)
    expect(requests[0]).toEqual(requests[1])
    expect(observations).toHaveLength(1)
    expect(observations[0].history.archivedLargeMessages).toBe(0)
    expect(stored.size).toBe(0)
    expect(network).not.toHaveBeenCalled()
  } finally {
    network.mockRestore()
  }
})
