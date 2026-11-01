import { expect, it } from 'vitest'
import {
  changeQueue,
  queueCommandSchema,
  type ConversationQueue,
} from '../../src/chat/core/conversation-queue'

function fixture(): ConversationQueue {
  const occurrenceId = crypto.randomUUID()
  return {
    version: 3,
    paused: true,
    items: [
      { id: 'human', messageId: 'human', text: 'Human request', createdAt: 1 },
      {
        id: occurrenceId,
        messageId: occurrenceId,
        text: 'Frozen scheduled request',
        createdAt: 2,
        origin: {
          kind: 'schedule',
          scheduleId: crypto.randomUUID(),
          revision: 1,
          occurrenceId,
        },
      },
    ],
  }
}

it('rejects editing an admitted scheduled occurrence without changing the queue', () => {
  const queue = fixture()
  const before = structuredClone(queue)
  const result = changeQueue(queue, {
    type: 'edit',
    version: queue.version,
    id: queue.items[1].id,
    text: 'Changed request',
  })
  expect(result).toMatchObject({
    ok: false,
    status: 400,
    error: expect.stringMatching(/edit the schedule/i),
  })
  expect(result.queue).toBe(queue)
  expect(queue).toEqual(before)
  expect(
    changeQueue(queue, {
      type: 'edit',
      version: queue.version,
      id: 'human',
      text: 'Changed human request',
    }),
  ).toMatchObject({
    ok: true,
    queue: { items: [{ text: 'Changed human request' }, queue.items[1]] },
  })
})

it('allows scheduled occurrences to be reordered, deleted, or cleared with normal queue version checks', () => {
  const queue = fixture()
  const scheduled = queue.items[1]
  const reordered = changeQueue(queue, {
    type: 'reorder',
    version: queue.version,
    ids: [scheduled.id, 'human'],
  })
  expect(reordered).toMatchObject({ ok: true, queue: { version: 4 } })
  expect(reordered.queue.items).toEqual([scheduled, queue.items[0]])
  expect(
    changeQueue(reordered.queue, {
      type: 'delete',
      version: queue.version,
      id: scheduled.id,
    }),
  ).toMatchObject({ ok: false, status: 409 })
  const deleted = changeQueue(reordered.queue, {
    type: 'delete',
    version: reordered.queue.version,
    id: scheduled.id,
  })
  expect(deleted).toMatchObject({ ok: true, queue: { version: 5 } })
  expect(deleted.queue.items).toEqual([queue.items[0]])
  const cleared = changeQueue(queue, { type: 'clear', version: queue.version })
  expect(cleared).toMatchObject({ ok: true, queue: { version: 4, items: [] } })
  expect(queue.items[1]).toEqual(scheduled)
})

it('does not accept scheduled provenance from a queue command', () => {
  const queue = fixture()
  expect(
    queueCommandSchema.safeParse({
      type: 'edit',
      version: queue.version,
      id: 'human',
      text: 'Spoofed request',
      origin: queue.items[1].origin,
    }).success,
  ).toBe(false)
})
