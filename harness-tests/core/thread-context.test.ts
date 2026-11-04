import { expect, it } from 'vitest'
import { threadContextSnapshot } from '../../src/chat/core/conversation-threads'
const message = (id: string, content: string) => ({
  id,
  role: 'user',
  parts: [{ type: 'text', content }],
})
it('captures earlier text with provenance, excluding source, future messages and tool output', () => {
  const snapshot = threadContextSnapshot(
    [
      message('budget', 'Budget is $2000'),
      {
        id: 'tool',
        role: 'tool',
        parts: [{ type: 'text', content: 'secret' }],
      },
      message('source', 'Compare apartments'),
      message('future', 'Changed my mind'),
    ],
    'source',
  )
  expect(snapshot.messages).toEqual([
    {
      messageId: 'budget',
      role: 'user',
      text: 'Budget is $2000',
      truncated: false,
    },
  ])
  expect(snapshot.throughMessageId).toBe('source')
})
it('bounds the total context and never substitutes recent history for a missing source', () => {
  const rows = Array.from({ length: 30 }, (_, i) =>
    message(String(i), 'x'.repeat(4000)),
  )
  const snapshot = threadContextSnapshot(rows, '29')
  expect(
    snapshot.messages.reduce((sum, m) => sum + m.text.length, 0),
  ).toBeLessThanOrEqual(12000)
  expect(snapshot.messages.every((m) => m.truncated)).toBe(true)
  expect(threadContextSnapshot(rows, 'missing').messages).toEqual([])
})
