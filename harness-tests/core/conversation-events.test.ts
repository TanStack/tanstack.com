import { retainArchivedMessages } from '../../src/chat/core/conversation-snapshot'
import { describe, expect, it } from 'vitest'
import { StreamProcessor } from '@tanstack/ai'
import { readMessageAttachments } from '../../src/chat/core/message-attachments'
import { readFileDeliveries } from '../../src/chat/core/file-deliveries'
import { deliveredMessage, fileDeliveryFixture } from './fixtures/file-delivery'
import {
  conversationEvents,
  type ProjectableConversation,
} from '../../src/chat/server/conversation-events'

const initial = (): ProjectableConversation => ({
  messages: [],
  status: 'idle',
  activeRun: null,
})
describe('conversation AG-UI projection', () => {
  it('streams confirmed file deliveries before a final answer and keeps them across failure and reload', () => {
    const running: ProjectableConversation = {
      status: 'running',
      activeRun: 'run',
      messages: [deliveredMessage()],
    }
    const before = structuredClone(running)
    before.messages[0].metadata = undefined
    const failed = {
      ...running,
      status: 'error',
      activeRun: null,
      error: 'Interrupted',
    }
    const live = new StreamProcessor()
    for (const state of [before, running, failed]) {
      const previous =
        state === before ? undefined : state === running ? before : running
      for (const event of conversationEvents(previous, state, 'chat'))
        live.processChunk(event)
    }
    expect(readFileDeliveries(live.getMessages()[0])).toEqual([
      fileDeliveryFixture,
    ])
    expect(live.getMessages()).toHaveLength(1)
    const reloaded = new StreamProcessor()
    for (const event of conversationEvents(undefined, failed, 'chat'))
      reloaded.processChunk(event)
    expect(readFileDeliveries(reloaded.getMessages()[0])).toEqual([
      fileDeliveryFixture,
    ])
    expect(
      reloaded.getMessages()[0].parts.some((part) => part.type === 'text'),
    ).toBe(false)
  })
  it.each(['Read this file', ''])(
    'preserves live attachment metadata before any answer for prompt %j',
    (content) => {
      const attachment = {
        id: crypto.randomUUID(),
        botId: 'bot',
        name: 'notes.txt',
        mediaType: 'text/plain',
        size: 3,
        sha256: 'a'.repeat(64),
        source: 'upload' as const,
        state: 'ready' as const,
        createdAt: 1,
      }
      const before = initial()
      const running: ProjectableConversation = {
        status: 'running',
        activeRun: 'run',
        messages: [
          {
            id: 'user',
            role: 'user',
            parts: [{ type: 'text', content }],
            metadata: { gumAttachments: [attachment] },
          },
        ],
      }
      for (const events of [
        conversationEvents(before, running, 'chat'),
        conversationEvents(undefined, running, 'chat'),
      ]) {
        const processor = new StreamProcessor()
        for (const event of events) processor.processChunk(event)
        const message = processor
          .getMessages()
          .find((message) => message.id === 'user')!
        expect(readMessageAttachments(message)).toEqual([attachment])
        expect(message.role).toBe('user')
        const done = { ...running, status: 'idle', activeRun: null }
        for (const event of conversationEvents(running, done, 'chat'))
          processor.processChunk(event)
        expect(readMessageAttachments(processor.getMessages()[0])).toEqual([
          attachment,
        ])
      }
    },
  )
  it('replaces changed message metadata without retaining removed fields or duplicating text', () => {
    const before: ProjectableConversation = {
      ...initial(),
      messages: [
        {
          id: 'user',
          role: 'user',
          parts: [{ type: 'text', content: 'A copied message' }],
          metadata: { gumInherited: true, obsolete: true },
          createdAt: new Date('2026-10-01T12:00:00Z'),
        },
      ],
    }
    const after = structuredClone(before)
    after.messages[0].metadata = { gumInherited: true }
    const processor = new StreamProcessor()
    for (const event of conversationEvents(undefined, before, 'chat'))
      processor.processChunk(event)
    for (const event of conversationEvents(before, after, 'chat')) {
      processor.processChunk(event)
      expect(processor.getMessages()).toHaveLength(1)
      expect(processor.getMessages()[0].parts).toEqual(before.messages[0].parts)
      expect(processor.getMessages()[0].createdAt).toEqual(
        before.messages[0].createdAt,
      )
    }
    expect(processor.getMessages()).toHaveLength(1)
    expect(processor.getMessages()[0]).toMatchObject({
      metadata: { gumInherited: true },
      parts: [{ type: 'text', content: 'A copied message' }],
    })
    expect(processor.getMessages()[0].metadata).not.toHaveProperty('obsolete')
  })
  it('replays text, tool arguments and results through the native processor', () => {
    const before = initial()
    const running: ProjectableConversation = {
      messages: [
        {
          id: 'u',
          role: 'user',
          parts: [{ type: 'text', content: 'Check messages' }],
        },
        {
          id: 'a',
          role: 'assistant',
          parts: [
            {
              type: 'tool-call',
              id: 't',
              name: 'search',
              arguments: '{"q":"work"}',
              state: 'input-complete',
            },
          ],
        },
      ],
      status: 'running',
      activeRun: 'run',
    }
    const done = structuredClone(running)
    done.status = 'idle'
    done.activeRun = null
    const tool = done.messages[1].parts[0]
    if (tool.type === 'tool-call') {
      tool.state = 'complete'
      tool.output = { found: 2 }
    }
    done.messages.push({
      id: 'answer',
      role: 'assistant',
      parts: [{ type: 'text', content: 'Two updates.' }],
    })
    const processor = new StreamProcessor()
    const events = [
      ...conversationEvents(undefined, before, 'chat'),
      ...conversationEvents(before, running, 'chat'),
      ...conversationEvents(running, done, 'chat'),
    ]
    for (const event of events) processor.processChunk(event)
    const messages = processor.getMessages()
    expect(messages.find((m) => m.id === 'u')?.parts).toContainEqual(
      expect.objectContaining({ type: 'text', content: 'Check messages' }),
    )
    expect(messages.flatMap((m) => m.parts)).toContainEqual(
      expect.objectContaining({
        type: 'tool-call',
        name: 'search',
        state: 'complete',
      }),
    )
    expect(messages.find((m) => m.id === 'answer')?.parts).toContainEqual(
      expect.objectContaining({ type: 'text', content: 'Two updates.' }),
    )
    expect(events.at(-1)?.type).toBe('RUN_FINISHED')
  })
  it('keeps streamed and replayed answer segments after their tools', () => {
    const partial: ProjectableConversation = {
      ...initial(),
      status: 'running',
      activeRun: 'run',
      messages: [
        {
          id: 'answer',
          role: 'assistant',
          parts: [
            { type: 'text', content: 'I will check the docs.' },
            {
              type: 'tool-call',
              id: 'lookup',
              name: 'search',
              arguments: '{}',
              state: 'complete',
              output: { found: true },
            },
            { type: 'text', content: '## What is an Azure resource' },
          ],
        },
      ],
    }
    const done = structuredClone(partial)
    done.status = 'idle'
    done.activeRun = null
    const answer = done.messages[0].parts[2]
    if (answer.type === 'text') answer.content += ' group?\n\nA container.'
    for (const events of [
      [
        ...conversationEvents(undefined, partial, 'chat'),
        ...conversationEvents(partial, done, 'chat'),
      ],
      conversationEvents(undefined, done, 'chat'),
    ]) {
      const processor = new StreamProcessor()
      for (const event of events) processor.processChunk(event)
      const parts = processor
        .getMessages()
        .find((m) => m.id === 'answer')!.parts
      expect(
        parts.filter((p) => p.type === 'text').map((p) => p.content),
      ).toEqual([
        'I will check the docs.',
        '## What is an Azure resource group?\n\nA container.',
      ])
      expect(parts.findIndex((p) => p.type === 'tool-call')).toBeGreaterThan(0)
      expect(parts.at(-1)).toMatchObject({
        type: 'text',
        content: answer.type === 'text' ? answer.content : '',
      })
    }
  })
  it('keeps displayed history when completed turns leave the live server window', () => {
    const before: ProjectableConversation = {
      ...initial(),
      messages: [
        {
          id: 'old',
          role: 'user',
          parts: [{ type: 'text', content: 'Earlier' }],
        },
        {
          id: 'current',
          role: 'user',
          parts: [{ type: 'text', content: 'Current' }],
        },
      ],
    }
    const after: ProjectableConversation = {
      ...before,
      archivedTurns: 1,
      messages: [
        before.messages[1],
        { id: 'new', role: 'user', parts: [{ type: 'text', content: 'New' }] },
      ],
    }
    const processor = new StreamProcessor()
    for (const event of conversationEvents(undefined, before, 'chat'))
      processor.processChunk(event)
    for (const event of conversationEvents(before, after, 'chat')) {
      processor.processChunk(event)
      expect(processor.getMessages()[0]).toMatchObject(before.messages[0])
    }
    expect(processor.getMessages().map((message) => message.id)).toEqual([
      'old',
      'current',
      'new',
    ])
  })
  it('keeps archived rows across an authoritative metadata snapshot and clears on reset', () => {
    const archived: ProjectableConversation = {
      ...initial(),
      archivedTurns: 1,
      messages: [
        {
          id: 'current',
          role: 'user',
          parts: [{ type: 'text', content: 'Current' }],
          metadata: { obsolete: true },
        },
      ],
    }
    const displayed = [
      {
        id: 'earlier',
        role: 'user',
        parts: [{ type: 'text', content: 'Earlier' }],
      },
      ...archived.messages,
    ] satisfies ProjectableConversation['messages']
    const next = structuredClone(archived)
    next.messages[0].metadata = undefined
    const processor = new StreamProcessor()
    for (const event of conversationEvents(
      undefined,
      { ...archived, messages: displayed },
      'chat',
    ))
      processor.processChunk(event)
    for (const event of conversationEvents(archived, next, 'chat')) {
      processor.processChunk(
        retainArchivedMessages(event, processor.getMessages()),
      )
      expect(processor.getMessages().map((message) => message.id)).toEqual([
        'earlier',
        'current',
      ])
    }
    expect(processor.getMessages()[1].metadata).not.toHaveProperty('obsolete')
    for (const event of conversationEvents(next, initial(), 'chat'))
      processor.processChunk(
        retainArchivedMessages(event, processor.getMessages()),
      )
    expect(processor.getMessages()).toEqual([])
  })
  it('publishes only appended text between saves and clears transcript on reset', () => {
    const old = {
      ...initial(),
      messages: [
        {
          id: 'a',
          role: 'assistant' as const,
          parts: [{ type: 'text' as const, content: 'Hello' }],
        },
      ],
    }
    const next = structuredClone(old)
    next.messages[0].parts[0].content += ' world'
    expect(conversationEvents(old, next, 'chat')).toContainEqual({
      type: 'TEXT_MESSAGE_CONTENT',
      messageId: 'a',
      delta: ' world',
    })
    expect(conversationEvents(next, initial(), 'chat')[0]).toMatchObject({
      type: 'MESSAGES_SNAPSHOT',
      messages: [],
    })
  })
})
