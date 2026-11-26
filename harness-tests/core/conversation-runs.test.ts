import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import { ConversationRuns } from '../../src/chat/server/conversation-runs'
import {
  acceptConversationRunSchema,
  conversationRunOriginSchema,
  conversationRunSchema,
  delegatedConversationRunOriginSchema,
  initiatingRunMessageId,
  readDelegatedRunOrigin,
  readScheduledRunOrigin,
  type AcceptConversationRun,
  type DelegatedConversationRunOrigin,
} from '../../src/chat/core/conversation-runs'
const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})
function fixture() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const sql = {
    exec(query: string, ...values: any[]) {
      const stmt = db.prepare(query)
      const rows = stmt.columns().length
        ? stmt.all(...values)
        : (stmt.run(...values), [])
      return { toArray: () => rows }
    },
  } as unknown as SqlStorage
  return { db, sql, runs: new ConversationRuns(sql) }
}
function input(id = 'a', createdAt = 1): AcceptConversationRun {
  return {
    id,
    createdAt,
    status: 'queued',
    mode: 'assistant',
    origin: { kind: 'user', messageId: id },
    identity: {
      workspaceId: 'w',
      userId: 'u',
      botId: 'b',
      conversationId: 'c',
    },
  }
}
function delegatedOrigin(): DelegatedConversationRunOrigin {
  return {
    kind: 'delegation',
    delegationId: crypto.randomUUID(),
    parentConversationId: 'parent/conversation',
    parentRunId: 'parent-run',
    parentTaskId: 'parent-task',
    parentEpoch: 'parent-epoch',
  }
}
it('keeps stable receipts across retries and reconstruction without transcript data', () => {
  const { runs, sql, db } = fixture()
  const accepted = runs.accept(input())
  runs.update('a', {
    status: 'running',
    startedAt: 2,
    assistantTaskId: 'task',
    executionId: 'first',
    updatedAt: 2,
  })
  const done = runs.update('a', {
    status: 'completed',
    completedAt: 3,
    updatedAt: 3,
  })
  const reconstructed = new ConversationRuns(sql)
  expect(
    reconstructed.accept({ ...input('a', 999), status: 'running' }),
  ).toEqual(done)
  expect(reconstructed.has('a')).toBe(true)
  expect(reconstructed.get('missing')).toBeUndefined()
  expect(reconstructed.list().items).toHaveLength(1)
  db.exec(
    'CREATE TABLE transcript_turns(id TEXT); DELETE FROM transcript_turns',
  )
  expect(reconstructed.has('a')).toBe(true)
  expect(accepted).toMatchObject({
    origin: { kind: 'user', messageId: 'a' },
    createdAt: 1,
  })
  expect(() =>
    runs.accept({ ...input('secret'), prompt: 'private text' } as any),
  ).toThrow()
  expect(() => runs.update('a', { error: 'private error' } as any)).toThrow()
  expect(
    db.prepare('SELECT json FROM conversation_runs').get()!.json,
  ).not.toContain('private')
})
it('rejects mismatched duplicate origin/mode and cross-scope new identities', () => {
  const { runs } = fixture()
  runs.accept(input())
  expect(() => runs.accept({ ...input(), mode: 'tools' })).toThrow(
    'different request',
  )
  expect(() =>
    runs.accept({ ...input(), origin: { kind: 'user', messageId: 'other' } }),
  ).toThrow()
  for (const key of [
    'workspaceId',
    'userId',
    'botId',
    'conversationId',
  ] as const) {
    expect(() =>
      runs.accept({
        ...input(),
        identity: { ...input().identity, [key]: 'other' },
      }),
    ).toThrow('different request')
    expect(() =>
      runs.accept({
        ...input('new'),
        identity: { ...input().identity, [key]: 'other' },
      }),
    ).toThrow('identity cannot change')
  }
  expect(runs.list().items).toHaveLength(1)
})
it('permits waiting and explicit interrupted continuation without altering original start or task', () => {
  const { runs } = fixture()
  runs.accept(input())
  runs.update('a', {
    status: 'running',
    startedAt: 2,
    assistantTaskId: 'task',
    executionId: 'one',
    updatedAt: 2,
  })
  runs.update('a', { status: 'waiting_approval', updatedAt: 3 })
  runs.update('a', { status: 'running', executionId: 'two', updatedAt: 4 })
  runs.update('a', { status: 'waiting_user', updatedAt: 5 })
  runs.update('a', { status: 'interrupted', completedAt: 6, updatedAt: 6 })
  expect(() => runs.update('a', { status: 'running', updatedAt: 7 })).toThrow(
    'completion time',
  )
  const resumed = runs.update('a', {
    status: 'running',
    completedAt: null,
    executionId: 'three',
    updatedAt: 7,
  })
  expect(resumed).toMatchObject({
    startedAt: 2,
    assistantTaskId: 'task',
    executionId: 'three',
  })
  expect(resumed.completedAt).toBeUndefined()
  expect(() => runs.update('a', { startedAt: 8 })).toThrow('start time')
  expect(() => runs.update('a', { assistantTaskId: 'other' })).toThrow(
    'task cannot change',
  )
  expect(() => runs.update('a', { updatedAt: 1 })).toThrow('backward')
  expect(() => runs.update('a', { status: 'queued' })).toThrow('transition')
  runs.update('a', { status: 'completed', completedAt: 8, updatedAt: 8 })
  expect(() =>
    runs.update('a', { status: 'running', completedAt: null }),
  ).toThrow('transition')
})
it('rejects invalid timestamp ordering and preserves prior receipt on rejected updates', () => {
  const { runs } = fixture()
  expect(() => runs.accept({ ...input(), startedAt: 0 })).toThrow('timestamps')
  runs.accept(input())
  expect(() =>
    runs.update('a', { status: 'completed', completedAt: 0 }),
  ).toThrow()
  expect(runs.get('a')!.status).toBe('queued')
  expect(() => runs.update('missing', { status: 'running' })).toThrow(
    'not found',
  )
})
it('paginates stable creation order with ties and excludes newer insertions after the cursor', () => {
  const { runs } = fixture()
  for (const id of ['a', 'b', 'c', 'd', 'e']) runs.accept(input(id, 10))
  const first = runs.list({ limit: 2 })
  expect(first.items.map((r) => r.id)).toEqual(['e', 'd'])
  runs.accept(input('new', 20))
  runs.update('c', { status: 'running', startedAt: 30, updatedAt: 30 })
  const second = runs.list({ limit: 2, cursor: first.nextCursor })
  expect(second.items.map((r) => r.id)).toEqual(['c', 'b'])
  const third = runs.list({ limit: 2, cursor: second.nextCursor })
  expect(third.items.map((r) => r.id)).toEqual(['a'])
  expect(third.nextCursor).toBeUndefined()
  expect(() => runs.list({ limit: 51 })).toThrow()
  expect(() => runs.list({ cursor: 'not-json' })).toThrow('cursor')
})
it('bounds queued work without pruning durable terminal receipts', () => {
  const { runs } = fixture()
  for (let i = 0; i < 100; i++) runs.accept(input(String(i), i))
  expect(runs.queued()).toHaveLength(100)
  expect(() => runs.accept(input('overflow', 101))).toThrow('queue is full')
  runs.update('0', { status: 'cancelled', completedAt: 101, updatedAt: 101 })
  runs.accept(input('replacement', 102))
  expect(runs.queued()).toHaveLength(100)
  expect(runs.has('0')).toBe(true)
  expect(runs.accept(input('0'))).toMatchObject({ status: 'cancelled' })
})

it('composes acceptance and updates with the caller transaction without cached receipts after rollback', () => {
  const { db, runs } = fixture()
  runs.accept(input())
  db.exec('BEGIN')
  runs.update('a', { status: 'running', startedAt: 2, updatedAt: 2 })
  runs.accept(input('b'))
  db.exec('ROLLBACK')
  expect(runs.get('a')!.status).toBe('queued')
  expect(runs.has('b')).toBe(false)
  db.exec('BEGIN')
  runs.update('a', { status: 'running', startedAt: 2, updatedAt: 2 })
  db.exec('COMMIT')
  expect(runs.get('a')!.status).toBe('running')
})

it('validates scheduled provenance and binds both admission and stored run IDs to the occurrence', () => {
  const occurrenceId = crypto.randomUUID()
  const origin = {
    kind: 'schedule' as const,
    scheduleId: crypto.randomUUID(),
    revision: 1,
    occurrenceId,
  }
  const scheduled = { ...input(occurrenceId), origin }
  expect(acceptConversationRunSchema.parse(scheduled)).toEqual(scheduled)
  expect(initiatingRunMessageId(scheduled)).toBe(occurrenceId)
  expect(initiatingRunMessageId(input('human'))).toBe('human')
  for (const invalid of [
    { ...origin, scheduleId: 'not-a-uuid' },
    { ...origin, occurrenceId: 'not-a-uuid' },
    { ...origin, revision: 0 },
    { ...origin, revision: 1.5 },
    { ...origin, messageId: occurrenceId },
    { kind: 'user', messageId: 'human', scheduleId: origin.scheduleId },
  ])
    expect(conversationRunOriginSchema.safeParse(invalid).success).toBe(false)
  for (const accepted of [scheduled, input('human')]) {
    const mismatched = { ...accepted, id: 'different-run' }
    expect(acceptConversationRunSchema.safeParse(mismatched).success).toBe(
      false,
    )
    expect(
      conversationRunSchema.safeParse({ ...mismatched, updatedAt: 1 }).success,
    ).toBe(false)
  }
})

it('preserves scheduled provenance across retries and rejects reuse for another revision or origin', () => {
  const { runs, sql } = fixture()
  const occurrenceId = crypto.randomUUID()
  const scheduled: AcceptConversationRun = {
    ...input(occurrenceId),
    origin: {
      kind: 'schedule',
      scheduleId: crypto.randomUUID(),
      revision: 1,
      occurrenceId,
    },
  }
  const accepted = runs.accept(scheduled)
  runs.update(occurrenceId, { status: 'running', startedAt: 2, updatedAt: 2 })
  const completed = runs.update(occurrenceId, {
    status: 'completed',
    completedAt: 3,
    updatedAt: 3,
  })
  const restored = new ConversationRuns(sql)
  expect(restored.accept({ ...scheduled, createdAt: 99 })).toEqual(completed)
  expect(restored.get(occurrenceId)?.origin).toEqual(accepted.origin)
  for (const origin of [
    { ...scheduled.origin, revision: 2 },
    { ...scheduled.origin, scheduleId: crypto.randomUUID() },
    { kind: 'user' as const, messageId: occurrenceId },
  ])
    expect(() => restored.accept({ ...scheduled, origin })).toThrow(
      'different request',
    )
  expect(restored.list().items).toEqual([completed])
})

it('binds delegated admission and stored run IDs to strict bounded provenance', () => {
  const origin = delegatedOrigin()
  const delegated = { ...input(origin.delegationId), origin }
  expect(acceptConversationRunSchema.parse(delegated)).toEqual(delegated)
  expect(initiatingRunMessageId(delegated)).toBe(origin.delegationId)
  expect(
    conversationRunSchema.parse({ ...delegated, updatedAt: 1 }).origin,
  ).toEqual(origin)
  for (const field of [
    'delegationId',
    'parentConversationId',
    'parentRunId',
    'parentTaskId',
    'parentEpoch',
  ]) {
    const missing = { ...origin } as Record<string, unknown>
    delete missing[field]
    expect(conversationRunOriginSchema.safeParse(missing).success).toBe(false)
    expect(
      conversationRunOriginSchema.safeParse({ ...origin, [field]: '' }).success,
    ).toBe(false)
  }
  for (const invalid of [
    { ...origin, delegationId: 'not-a-uuid' },
    { ...origin, parentConversationId: 'c'.repeat(1001) },
    { ...origin, parentRunId: 'r'.repeat(129) },
    { ...origin, parentTaskId: 't'.repeat(129) },
    { ...origin, parentEpoch: 'e'.repeat(1001) },
    { ...origin, messageId: origin.delegationId },
    { ...origin, occurrenceId: origin.delegationId },
  ])
    expect(conversationRunOriginSchema.safeParse(invalid).success).toBe(false)
  const boundary = {
    ...origin,
    parentConversationId: '会'.repeat(1000),
    parentRunId: 'r'.repeat(128),
    parentTaskId: 't'.repeat(128),
    parentEpoch: 'e'.repeat(1000),
  }
  expect(delegatedConversationRunOriginSchema.parse(boundary)).toEqual(boundary)
  expect(
    acceptConversationRunSchema.safeParse({ ...delegated, id: 'other' })
      .success,
  ).toBe(false)
  expect(
    conversationRunSchema.safeParse({
      ...delegated,
      id: 'other',
      updatedAt: 1,
    }).success,
  ).toBe(false)
})

it('reads only delegated metadata bound to the exact initiating message ID', () => {
  const origin = delegatedOrigin()
  const message = {
    id: origin.delegationId,
    metadata: { gumOrigin: origin },
  }
  expect(readDelegatedRunOrigin(message)).toEqual(origin)
  expect(readScheduledRunOrigin(message)).toBeUndefined()
  for (const invalid of [
    { ...message, id: crypto.randomUUID() },
    { id: origin.delegationId },
    { ...message, metadata: { gumOrigin: { ...origin, credentials: {} } } },
    {
      ...message,
      metadata: { gumOrigin: { kind: 'user', messageId: origin.delegationId } },
    },
  ])
    expect(readDelegatedRunOrigin(invalid)).toBeUndefined()
  const scheduled = {
    kind: 'schedule',
    scheduleId: crypto.randomUUID(),
    revision: 1,
    occurrenceId: origin.delegationId,
  }
  const scheduleMessage = {
    ...message,
    metadata: { gumOrigin: scheduled },
  }
  expect(readDelegatedRunOrigin(scheduleMessage)).toBeUndefined()
  expect(readScheduledRunOrigin(scheduleMessage)).toEqual(scheduled)
})

it('keeps delegated provenance after transcript reset and reconstruction and rejects retargeted retries', () => {
  const { runs, sql, db } = fixture()
  const origin = delegatedOrigin()
  const delegated: AcceptConversationRun = {
    ...input(origin.delegationId),
    origin,
  }
  runs.accept(delegated)
  runs.update(delegated.id, {
    status: 'running',
    startedAt: 2,
    assistantTaskId: 'child-task',
    updatedAt: 2,
  })
  const completed = runs.update(delegated.id, {
    status: 'completed',
    completedAt: 3,
    updatedAt: 3,
  })
  db.exec(
    "CREATE TABLE transcript_turns(id TEXT); INSERT INTO transcript_turns VALUES ('old'); DELETE FROM transcript_turns",
  )
  const restored = new ConversationRuns(sql)
  expect(
    restored.accept({ ...delegated, createdAt: 99, status: 'running' }),
  ).toEqual(completed)
  for (const field of [
    'parentConversationId',
    'parentRunId',
    'parentTaskId',
    'parentEpoch',
  ] as const)
    expect(() =>
      restored.accept({
        ...delegated,
        origin: { ...origin, [field]: `${origin[field]}-changed` },
      }),
    ).toThrow('different request')
  expect(() =>
    restored.accept({
      ...delegated,
      origin: { kind: 'user', messageId: delegated.id },
    }),
  ).toThrow('different request')
  expect(() =>
    restored.accept({
      ...delegated,
      identity: { ...delegated.identity, conversationId: 'other-child' },
    }),
  ).toThrow('different request')
  expect(() =>
    restored.update(delegated.id, {
      origin: { ...origin, parentEpoch: 'new' },
    } as any),
  ).toThrow()
  expect(restored.list().items).toEqual([completed])
})
