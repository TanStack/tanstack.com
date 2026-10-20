import type { ConversationEnvironment } from '../../src/chat/server/conversation-environment'
import { chat, maxIterations } from '@tanstack/ai'
import { describe, expect, it, vi } from 'vitest'
import { connectionSchema } from '../../src/chat/core/types'
import {
  decodeConversationReferenceCursor,
  encodeConversationReferenceCursor,
} from '../../src/chat/core/conversation-reference-cursor'
import { assistantReferenceTools } from '../../src/chat/server/message-references'
import { adapterFor } from '../../src/chat/server/providers'
import { archiveEarlierTurns } from '../../src/chat/server/transcript-archive'
import { conversationHarness } from './fixtures/conversation-runtime'

const source = { botId: 'b', conversationId: 'main-conversation' }
const visibleText = 'Visible handoff detail. '.repeat(800) + 'Final marker.'

async function referenceHarness() {
  const h = await conversationHarness({
    messages: [
      {
        id: 'source-message',
        role: 'user',
        parts: [{ type: 'text', content: visibleText }],
      },
    ],
  })
  await h.db`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES('requesting-conversation','b',${'00000000-0000-4000-8000-000000000001'})`
  const referenceContext = vi.spyOn(h.c, 'referenceContext')
  const getByName = vi.fn((id: string) => {
    if (id !== source.conversationId) throw new Error('Unexpected source')
    return h.c
  })
  Object.assign(h.env.CONVERSATIONS, { getByName })
  const tools = assistantReferenceTools({
    env: { ...h.env, CONVERSATIONS: { getByName } },
    scope: {
      workspaceId: 'w',
      userId: '00000000-0000-4000-8000-000000000001',
      botId: 'b',
      conversationId: 'requesting-conversation',
    },
    references: [{ kind: 'conversation', ...source, label: 'Source' }],
  })
  const read = tools.find((tool) => tool.name === 'read_conversation')
  const next = tools.find((tool) => tool.name === 'continue_conversation')
  if (!read || !next) throw new Error('Expected conversation reference tools')
  return {
    ...h,
    tools,
    read,
    next,
    referenceContext,
    getByName,
  }
}

function providerResponse(
  pass: number,
  call?: { name: string; args: Record<string, unknown> },
) {
  const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`
  return new Response(
    frame({
      id: `synthetic-response-${pass}`,
      choices: [
        {
          index: 0,
          delta: call
            ? {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id: `synthetic-call-${pass}`,
                    type: 'function',
                    function: {
                      name: call.name,
                      arguments: JSON.stringify(call.args),
                    },
                  },
                ],
              }
            : { role: 'assistant', content: 'Source read.' },
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
    { headers: { 'Content-Type': 'text/event-stream' } },
  )
}

async function sdkRun(
  h: Awaited<ReturnType<typeof referenceHarness>>,
  calls: (
    results: any[],
  ) => ({ name: string; args: Record<string, unknown> } | undefined)[],
) {
  const received: { name: string; args: unknown }[] = []
  const results: any[] = []
  const tools = h.tools.map((tool) => ({
    ...tool,
    execute: async (args: any) => {
      received.push({ name: tool.name, args: structuredClone(args) })
      const result = await tool.execute!(args)
      results.push(result)
      return result
    },
  }))
  let pass = 0
  const run = vi.fn(async () => providerResponse(pass, calls(results)[pass++]))
  const env = { ...h.env, AI: { run } } as unknown as ConversationEnvironment
  const events = []
  const network = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(
      Error('This SDK contract test must not use the network.'),
    )
  try {
    for await (const event of chat({
      adapter: adapterFor(
        connectionSchema.parse({
          provider: 'included',
          model: env.INCLUDED_MODEL,
        }),
        env,
      )!,
      messages: [{ role: 'user', content: 'Read the selected handoff.' }],
      tools,
      agentLoopStrategy: maxIterations(5),
    }))
      events.push(event)
    expect(network).not.toHaveBeenCalled()
  } finally {
    network.mockRestore()
  }
  return { run, received, results, events }
}

function archive(
  h: Awaited<ReturnType<typeof referenceHarness>>,
  text = 'Archived source detail.',
) {
  archiveEarlierTurns(
    h.ctx.storage.sql as any,
    {
      messages: [
        { id: 'old', role: 'user', parts: [{ type: 'text', content: text }] },
        {
          id: 'new',
          role: 'user',
          parts: [{ type: 'text', content: 'Current source detail.' }],
        },
      ],
      approvals: [],
    },
    1000000,
    1,
  )
}

describe('reference cursor contract through the real SDK and source storage', () => {
  it('emits required-only tool schemas and reads first then continues using the exact returned opaque cursor', async () => {
    const h = await referenceHarness()
    const { run, received, results, events } = await sdkRun(h, (pages) => [
      {
        name: 'read_conversation',
        args: { conversationId: source.conversationId },
      },
      { name: 'continue_conversation', args: { cursor: pages[0]?.nextPage } },
    ])
    expect(run).toHaveBeenCalledTimes(3)
    expect(events.filter((event) => event.type === 'RUN_ERROR')).toEqual([])
    expect(received).toEqual([
      {
        name: 'read_conversation',
        args: { conversationId: source.conversationId },
      },
      { name: 'continue_conversation', args: { cursor: results[0].nextPage } },
    ])
    expect(results.every((page) => page.ok)).toBe(true)
    expect(results[0].text + results[1].text).toBe('user: ' + visibleText)
    expect(results[1].nextPage).toBeUndefined()
    expect(results[1].transcriptEpoch).toBe(results[0].transcriptEpoch)
    for (const page of results)
      for (const key of [
        'revision',
        'offset',
        'nextOffset',
        'before',
        'nextBefore',
      ])
        expect(page).not.toHaveProperty(key)
    expect(h.referenceContext.mock.calls[0][1]?.revision).toBeUndefined()
    expect(h.referenceContext.mock.calls[1][1]).toMatchObject({
      offset: 16000,
      expectedEpoch: results[0].transcriptEpoch,
      revision: decodeConversationReferenceCursor(results[0].nextPage).revision,
    })
    const payload = (run.mock.calls[0] as unknown as [string, any])[1]
    const schemas = new Map<string, any>(
      payload.tools.map((tool: any) => [tool.function.name, tool.function]),
    )
    const first = schemas.get('read_conversation')
    // The included K2.6 host uses non-strict generation; schemas and local
    // cursor validation remain unchanged.
    expect(first.strict).toBe(false)
    expect(first.parameters.required).toEqual(['conversationId'])
    expect(Object.keys(first.parameters.properties)).toEqual(['conversationId'])
    expect(first.parameters.properties.conversationId).toMatchObject({
      type: 'string',
      enum: [source.conversationId],
    })
    expect(first.parameters.additionalProperties).toBe(false)
    const next = schemas.get('continue_conversation')
    expect(next.strict).toBe(false)
    expect(next.parameters.required).toEqual(['cursor'])
    expect(Object.keys(next.parameters.properties)).toEqual(['cursor'])
    expect(next.parameters.properties.cursor.type).toBe('string')
    expect(next.parameters.additionalProperties).toBe(false)
    expect(JSON.stringify(payload.tools)).not.toContain('\\p{')
    const continuationPayload = (
      run.mock.calls[1] as unknown as [string, any]
    )[1]
    expect(continuationPayload.messages).toContainEqual(
      expect.objectContaining({
        role: 'tool',
        content: JSON.stringify(results[0]),
      }),
    )
  })

  it('rejects the old invalid first-read shape at the SDK boundary and recovers with only the selected ID', async () => {
    const h = await referenceHarness()
    const { run, received, results } = await sdkRun(h, () => [
      {
        name: 'read_conversation',
        args: { ...source, before: null, offset: 0, revision: 'null' },
      },
      {
        name: 'read_conversation',
        args: { conversationId: source.conversationId },
      },
    ])
    expect(run).toHaveBeenCalledTimes(3)
    expect(received).toEqual([
      {
        name: 'read_conversation',
        args: { conversationId: source.conversationId },
      },
    ])
    expect(h.referenceContext).toHaveBeenCalledTimes(1)
    expect(results[0]).toMatchObject({
      ok: true,
      text: ('user: ' + visibleText).slice(0, 16000),
    })
    const repairPayload = (run.mock.calls[1] as unknown as [string, any])[1]
    expect(repairPayload.messages).toContainEqual(
      expect.objectContaining({
        role: 'tool',
        content: expect.stringMatching(/error|invalid|unrecognized/i),
      }),
    )
  })

  it('rejects a stale page after source changes and lets a fresh first read obtain a new cursor', async () => {
    const h = await referenceHarness()
    const first: any = await h.read.execute!({
      conversationId: source.conversationId,
    })
    await h.c.begin(h.input('source-update', 'New source information.'))
    await h.settle()
    const stale: any = await h.next.execute!({ cursor: first.nextPage })
    expect(stale).toMatchObject({
      ok: false,
      error: { code: 'source_changed', status: 409 },
    })
    expect(stale.error.message).toContain('read_conversation')
    const fresh: any = await h.read.execute!({
      conversationId: source.conversationId,
    })
    expect(fresh.ok).toBe(true)
    expect(fresh.nextPage).not.toBe(first.nextPage)
    const rest: any = await h.next.execute!({ cursor: fresh.nextPage })
    expect(rest.ok).toBe(true)
    expect(fresh.text + rest.text).toContain('New source information.')
  })

  it('starts an archived window without the preceding revision then continues that same archived window', async () => {
    const h = await referenceHarness()
    const archivedText =
      'Archived source detail. '.repeat(800) + 'Archive final marker.'
    archive(h, archivedText)
    const current: any = await h.read.execute!({
      conversationId: source.conversationId,
    })
    expect(current.nextPage).toBeTypeOf('string')
    expect(current.olderWindow).toBeTypeOf('string')
    const archiveCursor = decodeConversationReferenceCursor(current.olderWindow)
    expect(archiveCursor).toMatchObject({
      conversationId: source.conversationId,
      transcriptEpoch: current.transcriptEpoch,
      offset: 0,
    })
    expect(archiveCursor.before).toBeTypeOf('number')
    expect(archiveCursor.revision).toBeUndefined()
    const older: any = await h.next.execute!({ cursor: current.olderWindow })
    expect(older).toMatchObject({
      ok: true,
      window: 'archived',
      text: ('user: ' + archivedText).slice(0, 16000),
    })
    expect(h.referenceContext.mock.lastCall![1]).toMatchObject({
      before: archiveCursor.before,
      offset: 0,
      expectedEpoch: current.transcriptEpoch,
    })
    expect(h.referenceContext.mock.lastCall![1]?.revision).toBeUndefined()
    const pageCursor = decodeConversationReferenceCursor(older.nextPage)
    expect(pageCursor).toMatchObject({
      before: archiveCursor.before,
      offset: 16000,
      transcriptEpoch: current.transcriptEpoch,
    })
    expect(pageCursor.revision).toBeTypeOf('string')
    const end: any = await h.next.execute!({ cursor: older.nextPage })
    expect(end).toMatchObject({ ok: true, window: 'archived' })
    expect(older.text + end.text).toBe('user: ' + archivedText)
  })

  it('rejects both same-window and offset-zero archive cursors after a source reset', async () => {
    const h = await referenceHarness()
    archive(h)
    const first: any = await h.read.execute!({
      conversationId: source.conversationId,
    })
    await h.c.reset()
    await h.settle()
    for (const cursor of [first.nextPage, first.olderWindow])
      expect(await h.next.execute!({ cursor })).toMatchObject({
        ok: false,
        error: { code: 'source_changed', status: 409 },
      })
    const fresh: any = await h.read.execute!({
      conversationId: source.conversationId,
    })
    expect(fresh).toMatchObject({ ok: true, text: '' })
    expect(fresh.transcriptEpoch).not.toBe(first.transcriptEpoch)
    expect(fresh.nextPage).toBeUndefined()
    expect(fresh.olderWindow).toBeUndefined()
  })

  it('does not treat a valid encoded cursor for another source as authority', async () => {
    const h = await referenceHarness()
    const first: any = await h.read.execute!({
      conversationId: source.conversationId,
    })
    h.referenceContext.mockClear()
    h.getByName.mockClear()
    const forged = encodeConversationReferenceCursor({
      ...decodeConversationReferenceCursor(first.nextPage),
      conversationId: 'requesting-conversation',
    })
    expect(await h.next.execute!({ cursor: forged })).toMatchObject({
      ok: false,
    })
    expect(h.referenceContext).not.toHaveBeenCalled()
    expect(h.getByName).not.toHaveBeenCalled()
  })
})
