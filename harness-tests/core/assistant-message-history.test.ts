import { expect, it } from 'vitest'
import { convertMessagesToModelMessages, type UIMessage } from '@tanstack/ai'
import { assistantMessageHistory } from '../../src/chat/server/assistant-message-history'

it('keeps stopped tool evidence but removes malformed provider exchanges without changing the transcript', () => {
  const history: UIMessage[] = [
    {
      id: 'stopped',
      role: 'assistant',
      parts: [
        {
          type: 'tool-call',
          id: 'partial',
          name: 'save_file',
          arguments: '{"name":"guide.md","content":"unfinished',
          state: 'error',
          output: { error: 'This tool call ended without a result.' },
        },
        {
          type: 'tool-result',
          state: 'complete',
          toolCallId: 'partial',
          content: '{"error":"interrupted"}',
        },
        {
          type: 'tool-call',
          id: 'valid',
          name: 'read_file',
          arguments: '{"id":"existing"}',
          state: 'complete',
          output: { ok: true, text: 'saved evidence' },
        },
      ],
    },
    {
      id: 'next',
      role: 'user',
      parts: [{ type: 'text', content: 'Continue with another question.' }],
    },
  ]
  const saved = structuredClone(history)
  const original = convertMessagesToModelMessages(history)
  expect(() =>
    JSON.parse(
      original.flatMap((m) => m.toolCalls ?? [])[0]!.function.arguments,
    ),
  ).toThrow()
  const projected = assistantMessageHistory(history)
  const model = convertMessagesToModelMessages(projected)
  expect(model.flatMap((m) => m.toolCalls ?? []).map((c) => c.id)).toEqual([
    'valid',
  ])
  expect(
    model.filter((m) => m.role === 'tool').map((m) => m.toolCallId),
  ).toEqual(['valid'])
  expect(JSON.stringify(model)).toContain('unfinished')
  expect(JSON.stringify(model)).toContain('interrupted')
  expect(model.at(-1)).toMatchObject({
    role: 'user',
    content: 'Continue with another question.',
  })
  expect(history).toEqual(saved)
})

it('preserves well-formed failed tool calls and their outcomes for provider context', () => {
  const history: UIMessage[] = [
    {
      id: 'failed',
      role: 'assistant',
      parts: [
        {
          type: 'tool-call',
          id: 'call',
          name: 'read_file',
          arguments: '{"id":"missing"}',
          state: 'error',
          output: { error: 'File not found' },
        },
      ],
    },
  ]
  expect(assistantMessageHistory(history)).toEqual(history)
})
