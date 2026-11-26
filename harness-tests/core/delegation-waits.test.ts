import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import { DelegationWaits } from '../../src/chat/server/delegation-waits'
import type { DelegationWaitRequest } from '../../src/chat/core/delegation-wait'
const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})
function fixture() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const sql = {
    exec(query: string, ...args: any[]) {
      const stmt = db.prepare(query)
      const rows = stmt.columns().length
        ? stmt.all(...args)
        : (stmt.run(...args), [])
      return { toArray: () => rows }
    },
  } as unknown as SqlStorage
  return { db, sql, store: new DelegationWaits(sql) }
}
function request(): DelegationWaitRequest {
  return {
    id: crypto.randomUUID(),
    parent: {
      identity: {
        workspaceId: 'w',
        userId: 'u',
        botId: 'b',
        conversationId: 'c',
      },
      runId: 'r',
      taskId: 't',
      epoch: 'e',
    },
    toolCallId: 'tool-call',
    delegationIds: [crypto.randomUUID(), crypto.randomUUID()],
    createdAt: 1000,
  }
}
it('replays an immutable wait, normalizes child order and rejects changed reuse', () => {
  const { store, sql } = fixture()
  const input = request()
  const first = store.create(input)
  expect(
    store.create({
      ...input,
      delegationIds: [...input.delegationIds].reverse(),
    }),
  ).toEqual(first)
  expect(new DelegationWaits(sql).get(input.id)).toEqual(first)
  for (const patch of [
    { toolCallId: 'another-call' },
    { createdAt: 1001 },
    { delegationIds: [crypto.randomUUID()] },
    { parent: { ...input.parent, epoch: 'new' } },
  ])
    expect(() => store.create({ ...input, ...patch })).toThrow(
      'different request',
    )
})
it('claims one continuation exactly and does not reuse it after reconstruction', () => {
  const { store, sql } = fixture()
  const input = request()
  store.create(input)
  const executionId = crypto.randomUUID()
  const first = store.claim(input.id, input.parent, executionId, 2000)
  expect(first.status).toBe('resumed')
  expect(
    new DelegationWaits(sql).claim(input.id, input.parent, executionId, 3000),
  ).toEqual(first)
  expect(() =>
    store.claim(input.id, input.parent, crypto.randomUUID(), 3000),
  ).toThrow('already resumed')
  expect(store.cancel(input.id, input.parent, 3000)).toEqual(first)
})
it('permits only one pending wait per task and allows another after the first claim', () => {
  const { store } = fixture()
  const input = request()
  store.create(input)
  const next = { ...input, id: crypto.randomUUID(), toolCallId: 'next' }
  expect(() => store.create(next)).toThrow('already waiting')
  store.claim(input.id, input.parent, crypto.randomUUID(), 2000)
  expect(store.create({ ...next, createdAt: 2001 }).status).toBe('waiting')
})
it('fences cancelled waits and changed parent identities, and preserves the original receipt', () => {
  const { store } = fixture()
  const input = request()
  store.create(input)
  expect(() =>
    store.claim(
      input.id,
      { ...input.parent, epoch: 'new' },
      crypto.randomUUID(),
      2000,
    ),
  ).toThrow('belong')
  const cancelled = store.cancel(input.id, input.parent, 2000)
  expect(() =>
    store.claim(input.id, input.parent, crypto.randomUUID(), 3000),
  ).toThrow('cancelled')
  expect(store.create(input)).toEqual(cancelled)
  expect(store.cancelled(input.parent)).toEqual([cancelled])
  expect(store.cancelled({ ...input.parent, runId: 'other' })).toEqual([])
})
it('rolls a continuation claim back with its caller transaction', () => {
  const { db, store } = fixture()
  const input = request()
  store.create(input)
  db.exec('BEGIN')
  store.claim(input.id, input.parent, crypto.randomUUID(), 2000)
  db.exec('ROLLBACK')
  expect(store.get(input.id)?.status).toBe('waiting')
  expect(() =>
    store.claim(input.id, input.parent, crypto.randomUUID(), 999),
  ).toThrow()
})
