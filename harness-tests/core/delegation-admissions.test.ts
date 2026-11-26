import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import type { DelegationAdmission } from '../../src/chat/core/delegation'
import type { AcceptConversationRun } from '../../src/chat/core/conversation-runs'
import {
  DelegatedAdmissions,
  delegatedRunOrigin,
} from '../../src/chat/server/delegation-admissions'
import { ConversationRuns } from '../../src/chat/server/conversation-runs'
import { sqliteDoTransactions } from './fixtures/sqlite-do-storage'

const databases: DatabaseSync[] = []
afterEach(() => databases.splice(0).forEach((db) => db.close()))
function fixture() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const sql = {
    exec(query: string, ...values: any[]) {
      const statement = db.prepare(query)
      const rows = statement.columns().length
        ? statement.all(...values)
        : (statement.run(...values), [])
      return { toArray: () => rows }
    },
  } as unknown as SqlStorage
  return {
    db,
    sql,
    tx: sqliteDoTransactions(db).transactionSync,
    store: new DelegatedAdmissions(sql),
    runs: new ConversationRuns(sql),
  }
}
function admission(): DelegationAdmission {
  return {
    id: crypto.randomUUID(),
    parent: {
      identity: {
        workspaceId: 'w',
        userId: 'u',
        botId: 'b',
        conversationId: 'main',
      },
      runId: 'parent-run',
      taskId: 'parent-task',
      epoch: 'parent-epoch',
    },
    childConversationId: crypto.randomUUID(),
    objective: 'Compare the two supplied release notes.',
    context: 'Report differences with links to the supplied sources.',
    sourceMessageId: 'parent-run',
    source: {
      epoch: 'parent-epoch',
      digest: 'a'.repeat(43),
      role: 'user',
      text: 'Compare these releases.',
      truncated: false,
    },
    model: { provider: 'cloudflare', model: '@cf/moonshotai/kimi-k2.6' },
    createdAt: 10,
    deadline: 1000,
  }
}
function run(input: DelegationAdmission): AcceptConversationRun {
  return {
    id: input.id,
    identity: {
      ...input.parent.identity,
      conversationId: input.childConversationId,
    },
    origin: delegatedRunOrigin(input),
    mode: 'assistant',
    status: 'queued',
    createdAt: input.createdAt,
  }
}

it('commits one child admission and returns the same run after lost acknowledgment, reconstruction and transcript reset', () => {
  const h = fixture(),
    input = admission()
  const prepared = h.tx(() => h.store.prepare(input, 20))
  expect(prepared).toMatchObject({ status: 'prepared', version: 1 })
  expect(h.tx(() => h.store.prepare(input, 21))).toEqual(prepared)
  const accepted = h.tx(() => h.store.admit(input, run(input), h.runs, 30))
  h.db.exec('CREATE TABLE state(json TEXT); DELETE FROM state')
  const restored = new DelegatedAdmissions(h.sql)
  const restoredRuns = new ConversationRuns(h.sql)
  expect(
    h.tx(() => restored.admit(input, run(input), restoredRuns, 2000)),
  ).toEqual(accepted)
  expect(restored.get(input.id)).toMatchObject({
    status: 'admitted',
    version: 2,
    admittedAt: 30,
    updatedAt: 30,
  })
  expect(restoredRuns.list().items).toHaveLength(1)
})

it('rejects changed immutable payloads, not just changed parent provenance', () => {
  const h = fixture(),
    input = admission()
  h.tx(() => h.store.prepare(input, 20))
  const changes = [
    { objective: 'A different objective' },
    { context: 'New hidden context' },
    {
      sourceMessageId: 'another-message',
      parent: { ...input.parent, runId: 'another-message' },
    },
    { source: { ...input.source, text: 'Changed source' } },
    { childConversationId: crypto.randomUUID() },
    {
      parent: { ...input.parent, epoch: 'replacement' },
      source: { ...input.source, epoch: 'replacement' },
    },
    {
      parent: {
        ...input.parent,
        identity: { ...input.parent.identity, userId: 'other' },
      },
    },
    { model: { ...input.model, model: 'changed-model' } },
    { deadline: 1001 },
    { createdAt: 11 },
  ]
  for (const change of changes) {
    const altered = { ...input, ...change }
    expect(() => h.tx(() => h.store.prepare(altered, 30))).toThrow(
      'different request',
    )
    expect(() => h.tx(() => h.store.revoke(altered, 30))).toThrow(
      'different request',
    )
    expect(() =>
      h.tx(() => h.store.admit(altered, run(altered), h.runs, 30)),
    ).toThrow('different request')
  }
  expect(h.runs.list().items).toHaveLength(0)
})

it('requires the same owner, child conversation, model-loop mode and full parent lineage for a run', () => {
  const h = fixture(),
    input = admission(),
    candidate = run(input)
  h.tx(() => h.store.prepare(input, 20))
  const changes: Partial<AcceptConversationRun>[] = [
    { id: crypto.randomUUID() },
    { createdAt: 11 },
    { mode: 'system-one' },
    { origin: { kind: 'user', messageId: input.id } },
    { origin: { ...delegatedRunOrigin(input), parentRunId: 'other' } },
    ...['userId', 'botId', 'workspaceId', 'conversationId'].map((field) => ({
      identity: { ...candidate.identity, [field]: 'other' },
    })),
  ]
  for (const change of changes)
    expect(() =>
      h.tx(() => h.store.admit(input, { ...candidate, ...change }, h.runs, 30)),
    ).toThrow()
  expect(h.runs.list().items).toHaveLength(0)
  expect(h.store.get(input.id)?.status).toBe('prepared')
})

it('persists a cancellation tombstone before admission and rejects late or repeated start requests', () => {
  const h = fixture(),
    input = admission()
  const revoked = h.tx(() => h.store.revoke(input, 20))
  expect(revoked).toMatchObject({
    status: 'revoked',
    version: 1,
    revokedAt: 20,
  })
  const restored = new DelegatedAdmissions(h.sql)
  expect(h.tx(() => restored.prepare(input, 30))).toEqual(revoked)
  expect(h.tx(() => restored.revoke(input, 40))).toEqual(revoked)
  expect(() =>
    h.tx(() => restored.admit(input, run(input), h.runs, 50)),
  ).toThrow('revoked')
  expect(h.runs.list().items).toHaveLength(0)
})

it('revokes exact admission authority without claiming in-flight effects stopped or touching a later manual run', () => {
  const h = fixture(),
    input = admission()
  h.tx(() => h.store.prepare(input, 20))
  h.tx(() =>
    h.store.admit(
      input,
      { ...run(input), status: 'running', startedAt: 30 },
      h.runs,
      30,
    ),
  )
  const child = h.runs.get(input.id)
  const manual: AcceptConversationRun = {
    ...run(input),
    id: 'later',
    origin: { kind: 'user', messageId: 'later' },
    createdAt: 40,
  }
  h.tx(() => h.runs.accept(manual))
  expect(h.tx(() => h.store.admit(input, run(input), h.runs, 45))).toEqual(
    child,
  )
  const revoked = h.tx(() => h.store.revoke(input, 50))
  expect(revoked).toMatchObject({
    status: 'revoked',
    admittedAt: 30,
    revokedAt: 50,
  })
  expect(h.runs.get(input.id)).toEqual(child)
  expect(h.runs.get('later')?.status).toBe('queued')
  expect(() =>
    h.tx(() => h.store.admit(input, run(input), h.runs, 60)),
  ).toThrow('revoked')
})

it('requires preparation and refuses first admission at or after the deadline', () => {
  const h = fixture(),
    input = admission()
  expect(() =>
    h.tx(() => h.store.admit(input, run(input), h.runs, 20)),
  ).toThrow('Prepare')
  expect(() => h.tx(() => h.store.prepare(input, input.deadline))).toThrow(
    'expired',
  )
  h.tx(() => h.store.prepare(input, 20))
  expect(() =>
    h.tx(() => h.store.admit(input, run(input), h.runs, input.deadline)),
  ).toThrow('expired')
  expect(h.runs.list().items).toHaveLength(0)
  expect(h.tx(() => h.store.revoke(input, input.deadline)).status).toBe(
    'revoked',
  )
})

it('does not adopt a run admitted separately or reuse a child conversation for a second delegated task', () => {
  const h = fixture(),
    input = admission()
  h.tx(() => h.store.prepare(input, 20))
  h.tx(() => h.runs.accept(run(input)))
  expect(() =>
    h.tx(() => h.store.admit(input, run(input), h.runs, 30)),
  ).toThrow('already admitted another run')
  const next = {
    ...input,
    id: crypto.randomUUID(),
    parent: { ...input.parent, taskId: 'another-task' },
  }
  expect(() => h.tx(() => h.store.prepare(next, 30))).toThrow(
    'already has a delegated task',
  )
  expect(() => h.tx(() => h.store.revoke(next, 30))).toThrow(
    'already has a delegated task',
  )
})

it('refuses first admission when a manual send won the race after thread creation', () => {
  for (const status of ['running', 'completed'] as const) {
    const h = fixture(),
      input = admission()
    h.tx(() => h.store.prepare(input, 20))
    h.tx(() =>
      h.runs.accept({
        ...run(input),
        id: 'manual-first',
        origin: { kind: 'user', messageId: 'manual-first' },
        status: 'running',
        createdAt: 25,
        startedAt: 25,
      }),
    )
    if (status === 'completed')
      h.tx(() =>
        h.runs.update('manual-first', {
          status,
          updatedAt: 26,
          completedAt: 26,
        }),
      )
    const original = h.runs.get('manual-first')
    expect(() =>
      h.tx(() => h.store.admit(input, run(input), h.runs, 30)),
    ).toThrow('already admitted another run')
    expect(h.runs.get(input.id)).toBeUndefined()
    expect(h.runs.get('manual-first')).toEqual(original)
    expect(h.store.get(input.id)?.status).toBe('prepared')
  }
})

it('rolls back the run if publishing its delegation receipt fails in the same storage transaction', () => {
  const h = fixture(),
    input = admission()
  h.tx(() => h.store.prepare(input, 20))
  h.db.exec(`CREATE TRIGGER fail_receipt BEFORE UPDATE ON delegated_admissions
    BEGIN SELECT RAISE(ABORT, 'synthetic publication failure'); END`)
  expect(() =>
    h.tx(() => h.store.admit(input, run(input), h.runs, 30)),
  ).toThrow('synthetic publication failure')
  expect(h.runs.get(input.id)).toBeUndefined()
  expect(h.store.get(input.id)?.status).toBe('prepared')
  h.db.exec('DROP TRIGGER fail_receipt')
  expect(
    h.tx(() => h.store.admit(input, run(input), h.runs, 40)),
  ).toMatchObject({ id: input.id, status: 'queued' })
})

it('does not hide missing admitted-run evidence or move receipt timestamps backward', () => {
  const h = fixture(),
    input = admission()
  h.tx(() => h.store.prepare(input, 20))
  for (const operation of [
    () => h.store.prepare(input, 19),
    () => h.store.revoke(input, 19),
    () => h.store.admit(input, run(input), h.runs, 19),
  ])
    expect(() =>
      h.tx(() => {
        operation()
      }),
    ).toThrow('backward')
  h.tx(() => h.store.admit(input, run(input), h.runs, 30))
  h.db.exec('DELETE FROM conversation_runs')
  expect(() =>
    h.tx(() => h.store.admit(input, run(input), h.runs, 40)),
  ).toThrow('receipt is missing')
  expect(h.runs.get(input.id)).toBeUndefined()
})

it('records an occupied rejection durably without admitting execution or changing manual work', () => {
  const h = fixture(),
    entry = admission()
  const manual = {
    ...run(entry),
    id: 'manual',
    origin: { kind: 'user' as const, messageId: 'manual' },
  }
  h.tx(() => h.runs.accept(manual))
  const before = h.runs.get('manual')
  const rejected = h.tx(() => h.store.rejectOccupied(entry, h.runs, 20))
  expect(rejected.status).toBe('failed')
  expect(rejected.startedAt).toBeUndefined()
  expect(h.runs.get('manual')).toEqual(before)
  expect(h.store.get(entry.id)).toMatchObject({
    status: 'rejected',
    rejectedAt: 20,
  })
  expect(h.store.get(entry.id)?.admittedAt).toBeUndefined()
  const restored = new DelegatedAdmissions(h.sql)
  expect(h.tx(() => restored.rejectOccupied(entry, h.runs, 1200))).toEqual(
    rejected,
  )
  expect(() =>
    h.tx(() => restored.admit(entry, run(entry), h.runs, 30)),
  ).toThrow('rejected')
  expect(() =>
    h.tx(() =>
      restored.rejectOccupied({ ...entry, objective: 'changed' }, h.runs, 30),
    ),
  ).toThrow('different request')
})
it('rolls back occupied rejection receipts and does not reject an empty or revoked child', () => {
  const h = fixture(),
    entry = admission()
  expect(() => h.tx(() => h.store.rejectOccupied(entry, h.runs, 20))).toThrow(
    'No conflicting run',
  )
  h.tx(() =>
    h.runs.accept({
      ...run(entry),
      id: 'manual',
      origin: { kind: 'user', messageId: 'manual' },
    }),
  )
  expect(() =>
    h.tx(() => {
      h.store.rejectOccupied(entry, h.runs, 20)
      throw Error('rollback')
    }),
  ).toThrow('rollback')
  expect(h.runs.get(entry.id)).toBeUndefined()
  expect(h.store.get(entry.id)).toBeUndefined()
  h.tx(() => h.store.revoke(entry, 21))
  expect(() => h.tx(() => h.store.rejectOccupied(entry, h.runs, 22))).toThrow(
    'cannot be rejected',
  )
})
