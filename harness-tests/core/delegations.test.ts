import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import {
  delegationAdmissionSchema,
  delegationRecordSchema,
  maxDelegationLifetimeMs,
  type DelegationAdmission,
} from '../../src/chat/core/delegation'
import { DelegationError, Delegations } from '../../src/chat/server/delegations'

const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})
function fixture() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  let failure: string | undefined
  const sql = {
    exec(query: string, ...values: any[]) {
      if (failure && query.startsWith(failure)) {
        failure = undefined
        throw new Error('Synthetic storage failure')
      }
      const statement = db.prepare(query)
      const rows = statement.columns().length
        ? statement.all(...values)
        : (statement.run(...values), [])
      return { toArray: () => rows }
    },
  } as unknown as SqlStorage
  const ledger = new Delegations(sql)
  return {
    db,
    sql,
    ledger,
    failNext: (prefix: string) => {
      failure = prefix
    },
  }
}
function input(patch: Partial<DelegationAdmission> = {}): DelegationAdmission {
  const parent = patch.parent ?? {
    identity: {
      workspaceId: 'workspace',
      userId: 'viewer',
      botId: 'assistant',
      conversationId: 'main',
    },
    runId: 'run',
    taskId: 'task',
    epoch: 'original-epoch',
  }
  return {
    id: crypto.randomUUID(),
    parent,
    childConversationId: crypto.randomUUID(),
    objective: 'Compare the supplied evidence.',
    context: 'Only the selected source is provided.',
    sourceMessageId: parent.runId,
    source: {
      epoch: parent.epoch,
      digest: 'a'.repeat(43),
      role: 'user',
      text: 'Review this.',
      truncated: false,
    },
    model: {
      provider: 'included',
      model: 'fixture-model',
      reasoning: 'default',
    },
    createdAt: 1000,
    deadline: 61_000,
    ...patch,
  }
}
const count = (db: DatabaseSync) =>
  db.prepare('SELECT COUNT(*) AS count FROM delegations').get()!.count

it('recovers immutable receipts across repeated admission and reconstruction', () => {
  const { ledger, sql, db } = fixture()
  const request = input()
  const first = ledger.admit({
    ...request,
    objective: `  ${request.objective}\n`,
  })
  expect(first).toMatchObject({
    ...request,
    status: 'pending',
    version: 1,
    updatedAt: request.createdAt,
  })
  ledger.reserve(request.id, 1500)
  const accepted = ledger.acknowledge(request.id, 2000)
  expect(accepted).toMatchObject({
    status: 'admitted',
    admittedAt: 2000,
    version: 3,
    updatedAt: 2000,
  })
  expect(ledger.acknowledge(request.id, 3000)).toEqual(accepted)
  const reconstructed = new Delegations(sql)
  expect(reconstructed.admit(request)).toEqual(accepted)
  expect(reconstructed.get(request.id)).toEqual(accepted)
  expect(count(db)).toBe(1)
  db.exec('CREATE TABLE transcript(id TEXT); DELETE FROM transcript')
  expect(reconstructed.get(request.id)).toEqual(accepted)
  // Returned objects cannot mutate the stored request.
  accepted.context = 'changed outside SQL'
  expect(reconstructed.get(request.id)?.context).toBe(request.context)
})

it('compares every immutable field canonically, including creation time, model and source', () => {
  const { ledger, db } = fixture()
  const request = input()
  ledger.admit(request)
  const changes: Partial<DelegationAdmission>[] = [
    { childConversationId: crypto.randomUUID() },
    { objective: 'Different objective' },
    { context: 'Different context' },
    {
      sourceMessageId: 'other-source',
      parent: { ...request.parent, runId: 'other-source' },
    },
    { source: { ...request.source, text: 'Different source' } },
    { source: { ...request.source, truncated: true } },
    { source: { ...request.source, digest: 'b'.repeat(43) } },
    {
      source: { ...request.source, epoch: 'other-epoch' },
      parent: { ...request.parent, epoch: 'other-epoch' },
    },
    { model: { ...request.model, model: 'other-model' } },
    { model: { ...request.model, reasoning: 'high' } },
    { createdAt: 1001 },
    { deadline: 61_001 },
    { parent: { ...request.parent, taskId: 'other-task' } },
  ]
  for (const change of changes)
    expect(() => ledger.admit({ ...request, ...change })).toThrow(
      'different request',
    )
  const reordered = {
    ...request,
    model: {
      reasoning: 'default',
      model: 'fixture-model',
      provider: 'included' as const,
    },
    parent: {
      epoch: request.parent.epoch,
      taskId: 'task',
      runId: 'run',
      identity: {
        conversationId: 'main',
        botId: 'assistant',
        userId: 'viewer',
        workspaceId: 'workspace',
      },
    },
  }
  expect(ledger.admit(reordered)).toEqual(ledger.get(request.id))
  expect(count(db)).toBe(1)
})

it('rejects cross-conversation identities, changed task parents, and reused child rooms', () => {
  const { ledger, db } = fixture()
  const first = input()
  ledger.admit(first)
  for (const field of [
    'workspaceId',
    'userId',
    'botId',
    'conversationId',
  ] as const) {
    const parent = {
      ...first.parent,
      identity: { ...first.parent.identity, [field]: 'other' },
    }
    expect(() => ledger.admit({ ...first, parent })).toThrow(
      'different request',
    )
    expect(() => ledger.admit(input({ parent }))).toThrow(
      'identity cannot change',
    )
  }
  for (const field of ['runId', 'epoch'] as const)
    expect(() =>
      ledger.admit(input({ parent: { ...first.parent, [field]: 'other' } })),
    ).toThrow('parent task identity')
  expect(() =>
    ledger.admit(input({ childConversationId: first.childConversationId })),
  ).toThrow('already belongs')
  expect(count(db)).toBe(1)
})

it('retains the four-child lifetime fanout limit, including cancelled children', () => {
  const { ledger, db } = fixture()
  const requests = Array.from({ length: 4 }, () => input())
  for (const request of requests) ledger.admit(request)
  ledger.cancel(requests[0].id, 2000)
  ledger.confirmCancelled(requests[0].id, 2001)
  expect(() => ledger.admit(input())).toThrow('delegation limit')
  expect(ledger.admit(requests[0]).status).toBe('cancelled')
  const nextTask = input({
    parent: { ...requests[0].parent, taskId: 'next-task', runId: 'next-run' },
  })
  expect(ledger.admit(nextTask).status).toBe('pending')
  expect(count(db)).toBe(5)
})

it('reserves the two slots before either child admits and keeps retries in the same slot', () => {
  const { ledger } = fixture()
  const requests = Array.from({ length: 4 }, (_, i) =>
    input({ createdAt: 1000 + i }),
  )
  for (const request of [...requests].reverse()) ledger.admit(request)
  expect(ledger.pending(1000).map((item) => item.id)).toEqual([requests[0].id])
  expect(ledger.pending(2000).map((item) => item.id)).toEqual(
    requests.slice(0, 2).map((item) => item.id),
  )
  const reserved = ledger.reserve(requests[0].id, 2000)
  expect(reserved).toMatchObject({
    status: 'dispatching',
    dispatchedAt: 2000,
    version: 2,
  })
  expect(ledger.reserve(requests[0].id, 2001)).toEqual(reserved)
  expect(ledger.pending(2000).map((item) => item.id)).toEqual([requests[1].id])
  ledger.reserve(requests[1].id, 2000)
  expect(ledger.pending(2000)).toEqual([])
  expect(() => ledger.reserve(requests[2].id, 2000)).toThrow(
    'no available delegation slots',
  )
  expect(() => ledger.acknowledge(requests[2].id, 2000)).toThrow('Reserve')
  ledger.acknowledge(requests[1].id, 2002)
  // Waiting for approval/user is child execution state. Admission remains occupied.
  expect(ledger.get(requests[1].id)?.status).toBe('admitted')
  ledger.cancel(requests[0].id, 3000)
  expect(ledger.get(requests[0].id)?.admittedAt).toBeUndefined()
  expect(() => ledger.reserve(requests[0].id, 3000)).toThrow('cancelled')
  expect(ledger.pending(3000)).toEqual([])
  ledger.confirmCancelled(requests[0].id, 4000)
  expect(ledger.pending(4000).map((item) => item.id)).toEqual([requests[2].id])
})

it('holds uncertain pending cancellation until confirmed and prevents a late admission acknowledgment', () => {
  const { ledger, sql } = fixture()
  const requests = Array.from({ length: 3 }, () => input())
  for (const request of requests) ledger.admit(request)
  const stopping = ledger.cancel(requests[0].id, 2000)
  expect(stopping).toMatchObject({
    status: 'cancelling',
    version: 2,
    cancelRequestedAt: 2000,
  })
  expect(stopping.admittedAt).toBeUndefined()
  expect(stopping.cancelledAt).toBeUndefined()
  expect(ledger.pending(2000)).toHaveLength(1)
  expect(() => ledger.acknowledge(requests[0].id, 2001)).toThrow('cancelled')
  expect(new Delegations(sql).get(requests[0].id)).toEqual(stopping)
  expect(ledger.cancel(requests[0].id, 3000)).toEqual(stopping)
  const cancelled = ledger.confirmCancelled(requests[0].id, 3000)
  expect(cancelled).toMatchObject({
    status: 'cancelled',
    cancelledAt: 3000,
    version: 3,
  })
  expect(ledger.confirmCancelled(requests[0].id, 4000)).toEqual(cancelled)
  expect(ledger.pending(4000)).toHaveLength(2)
  expect(() => ledger.acknowledge(requests[0].id, 4000)).toThrow('cancelled')
  expect(() => ledger.confirmCancelled(requests[1].id, 4000)).toThrow(
    'must be requested',
  )
})

it('cancels only the complete parent identity without changing siblings or claiming effects stopped', () => {
  const { ledger } = fixture()
  const first = input(),
    second = input()
  const other = input({
    parent: { ...first.parent, taskId: 'other-task', runId: 'other-run' },
  })
  for (const request of [first, second, other]) ledger.admit(request)
  ledger.reserve(first.id, 2000)
  ledger.acknowledge(first.id, 2000)
  expect(
    ledger.cancelParent({ ...first.parent, epoch: 'new-epoch' }, 3000),
  ).toEqual([])
  const results = ledger.cancelParent(first.parent, 3000)
  expect(results).toHaveLength(2)
  expect(
    results.every(
      (item) => item.status === 'cancelling' && item.cancelledAt === undefined,
    ),
  ).toBe(true)
  expect(ledger.get(other.id)?.status).toBe('pending')
  expect(ledger.cancelParent(first.parent, 4000)).toEqual(results)
})

it('expires pending and admitted work at the deadline without inventing cancelled outcomes', () => {
  const { ledger, sql } = fixture()
  const first = input({ deadline: 4000 }),
    second = input({ deadline: 5000 })
  ledger.admit(first)
  ledger.admit(second)
  ledger.reserve(second.id, 2000)
  ledger.acknowledge(second.id, 2000)
  expect(ledger.nextWake()).toBe(4000)
  expect(ledger.pending(3999).map((item) => item.id)).toEqual([first.id])
  expect(ledger.pending(4000)).toEqual([])
  expect(() => ledger.acknowledge(first.id, 4000)).toThrow('deadline')
  ledger.expire(4000)
  expect(ledger.get(first.id)).toMatchObject({
    status: 'cancelling',
    cancelRequestedAt: 4000,
    version: 2,
  })
  expect(ledger.nextWake()).toBe(5000)
  ledger.expire(5000)
  expect(ledger.get(second.id)).toMatchObject({
    status: 'cancelling',
    admittedAt: 2000,
    cancelRequestedAt: 5000,
    version: 4,
  })
  expect(ledger.nextWake()).toBeUndefined()
  ledger.expire(6000)
  expect(new Delegations(sql).get(second.id)?.version).toBe(4)
  expect(ledger.get(second.id)?.cancelledAt).toBeUndefined()
  expect(() => ledger.acknowledge(second.id, 6000)).toThrow('deadline')
})

it('reconstructs reserved and cancelling work in stable order and expires ambiguous dispatch', () => {
  const { ledger, sql } = fixture()
  const first = input({ createdAt: 1000, deadline: 4000 })
  const second = input({ createdAt: 1001, deadline: 5000 })
  for (const request of [second, first]) ledger.admit(request)
  ledger.reserve(second.id, 2000)
  ledger.reserve(first.id, 2001)
  const reconstructed = new Delegations(sql)
  expect(reconstructed.dispatching().map((record) => record.id)).toEqual([
    first.id,
    second.id,
  ])
  expect(reconstructed.reserve(first.id, 3000)).toEqual(ledger.get(first.id))
  expect(reconstructed.cancelling()).toEqual([])
  expect(() => reconstructed.reserve(first.id, 4000)).toThrow('deadline')
  reconstructed.expire(4000)
  expect(reconstructed.get(first.id)).toMatchObject({
    status: 'cancelling',
    dispatchedAt: 2001,
    cancelRequestedAt: 4000,
  })
  expect(reconstructed.get(first.id)?.admittedAt).toBeUndefined()
  expect(reconstructed.get(first.id)?.cancelledAt).toBeUndefined()
  expect(reconstructed.dispatching().map((record) => record.id)).toEqual([
    second.id,
  ])
  expect(reconstructed.cancelling().map((record) => record.id)).toEqual([
    first.id,
  ])
  expect(() => reconstructed.acknowledge(first.id, 4001)).toThrow('deadline')
})

it('does not reserve or acknowledge work after cancellation and admission retry never adds a slot', () => {
  const { ledger } = fixture()
  const first = input(),
    second = input()
  ledger.admit(first)
  ledger.admit(second)
  expect(() => ledger.acknowledge(first.id, 2000)).toThrow('Reserve')
  ledger.reserve(first.id, 2000)
  const admitted = ledger.acknowledge(first.id, 2001)
  expect(ledger.reserve(first.id, 2002)).toEqual(admitted)
  expect(ledger.acknowledge(first.id, 2002)).toEqual(admitted)
  expect(ledger.reserve(second.id, 2002).status).toBe('dispatching')
  ledger.cancel(second.id, 2003)
  expect(() => ledger.acknowledge(second.id, 2004)).toThrow('cancelled')
  expect(() => ledger.reserve(second.id, 2004)).toThrow('cancelled')
})

it('preserves receipts on rejected timestamps and reports missing IDs without creating work', () => {
  const { ledger, db } = fixture()
  const request = input()
  const first = ledger.admit(request)
  expect(() => ledger.reserve(request.id, 999)).toThrow('backward')
  expect(ledger.get(request.id)).toEqual(first)
  ledger.reserve(request.id, 2000)
  expect(() => ledger.acknowledge(request.id, 1999)).toThrow('backward')
  const accepted = ledger.acknowledge(request.id, 3000)
  expect(() => ledger.cancel(request.id, 2999)).toThrow('backward')
  expect(ledger.get(request.id)).toEqual(accepted)
  for (const now of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 2.5]) {
    expect(() => ledger.pending(now)).toThrow()
    expect(() => ledger.cancel(request.id, now)).toThrow()
    expect(() => ledger.expire(now)).toThrow()
  }
  expect(ledger.get(crypto.randomUUID())).toBeUndefined()
  expect(() => ledger.cancel(crypto.randomUUID(), 4000)).toThrow(
    DelegationError,
  )
  expect(count(db)).toBe(1)
})

it('validates every parent cancellation before mutating any record', () => {
  const { ledger } = fixture()
  const first = input({ createdAt: 1000 }),
    second = input({ createdAt: 1001 })
  ledger.admit(first)
  ledger.admit(second)
  ledger.reserve(second.id, 4500)
  ledger.acknowledge(second.id, 5000)
  expect(() => ledger.cancelParent(first.parent, 4000)).toThrow('backward')
  expect(ledger.get(first.id)?.status).toBe('pending')
  expect(ledger.get(second.id)?.status).toBe('admitted')
})

it('keeps storage failures retryable and composes with a caller transaction rollback', () => {
  const { ledger, sql, db, failNext } = fixture()
  const request = input()
  failNext('INSERT INTO delegations')
  expect(() => ledger.admit(request)).toThrow('Synthetic storage failure')
  expect(ledger.get(request.id)).toBeUndefined()
  const first = ledger.admit(request)
  failNext('UPDATE delegations')
  expect(() => ledger.reserve(request.id, 2000)).toThrow(
    'Synthetic storage failure',
  )
  expect(new Delegations(sql).get(request.id)).toEqual(first)
  const reserved = ledger.reserve(request.id, 2000)
  failNext('UPDATE delegations')
  expect(() => ledger.acknowledge(request.id, 2000)).toThrow(
    'Synthetic storage failure',
  )
  expect(new Delegations(sql).get(request.id)).toEqual(reserved)
  const accepted = ledger.acknowledge(request.id, 2000)
  db.exec('BEGIN')
  try {
    ledger.cancel(request.id, 3000)
    throw new Error('Synthetic caller save failure')
  } catch {
    db.exec('ROLLBACK')
  }
  expect(new Delegations(sql).get(request.id)).toEqual(accepted)
  expect(ledger.cancel(request.id, 3000).status).toBe('cancelling')
})

describe('delegation schemas', () => {
  it('binds admission and recovered records to the initiating user message and parent epoch', () => {
    const { ledger, db } = fixture()
    const request = input()
    const wrongMessage = { ...request, sourceMessageId: 'different-message' }
    const wrongEpoch = {
      ...request,
      source: { ...request.source, epoch: 'different-epoch' },
    }
    for (const invalid of [wrongMessage, wrongEpoch]) {
      expect(delegationAdmissionSchema.safeParse(invalid).success).toBe(false)
      expect(() => ledger.admit(invalid)).toThrow('source')
      expect(
        delegationRecordSchema.safeParse({
          ...invalid,
          status: 'pending',
          version: 1,
          updatedAt: request.createdAt,
        }).success,
      ).toBe(false)
    }
    expect(count(db)).toBe(0)
    const accepted = ledger.admit(request)
    expect(accepted.sourceMessageId).toBe(accepted.parent.runId)
    expect(accepted.source.epoch).toBe(accepted.parent.epoch)
    for (const invalid of [wrongMessage, wrongEpoch])
      expect(() => ledger.admit(invalid)).toThrow('source')
    expect(ledger.get(request.id)).toEqual(accepted)
  })
  it('bounds source, objective, context, model and safe lifetime without accepting instructions as authority', () => {
    const request = input()
    for (const invalid of [
      { ...request, id: 'not-uuid' },
      { ...request, childConversationId: 'not-uuid' },
      {
        ...request,
        parent: {
          ...request.parent,
          identity: {
            ...request.parent.identity,
            conversationId: request.childConversationId,
          },
        },
      },
      { ...request, objective: ' \n ' },
      { ...request, objective: 'a'.repeat(6001) },
      { ...request, context: 'a'.repeat(12001) },
      { ...request, sourceMessageId: 'a'.repeat(129) },
      { ...request, source: { ...request.source, role: 'assistant' } },
      { ...request, source: { ...request.source, text: 'a'.repeat(12001) } },
      { ...request, parent: { ...request.parent, epoch: 'a'.repeat(1001) } },
      { ...request, parent: { ...request.parent, role: 'admin' } },
      { ...request, model: { ...request.model, apiKey: 'secret' } },
      { ...request, createdAt: -1 },
      { ...request, deadline: request.createdAt },
      { ...request, deadline: request.createdAt - 1 },
      { ...request, deadline: request.createdAt + maxDelegationLifetimeMs + 1 },
      { ...request, deadline: Number.MAX_SAFE_INTEGER + 1 },
      { ...request, admittedAt: 2000 },
    ])
      expect(delegationAdmissionSchema.safeParse(invalid).success).toBe(false)
    expect(
      delegationAdmissionSchema.parse({
        ...request,
        objective: ' a ',
        context: '',
        deadline: request.createdAt + maxDelegationLifetimeMs,
      }).objective,
    ).toBe('a')
  })
  it('rejects forged lifecycle records with inconsistent timestamps or completion claims', () => {
    const record = {
      ...input(),
      status: 'pending',
      version: 1,
      updatedAt: 1000,
    }
    expect(delegationRecordSchema.safeParse(record).success).toBe(true)
    for (const patch of [
      { status: 'completed' },
      { status: 'admitted' },
      { status: 'cancelling' },
      { status: 'cancelled', cancelledAt: 1000 },
      { admittedAt: 1000 },
      { cancelRequestedAt: 1000 },
      { updatedAt: 999 },
      { status: 'admitted', admittedAt: 1001 },
      { version: 0 },
    ])
      expect(
        delegationRecordSchema.safeParse({ ...record, ...patch }).success,
      ).toBe(false)
  })
})

it('settles authoritative terminal reports, releases slots, and makes late acknowledgments harmless', () => {
  const { ledger, sql } = fixture()
  const requests = Array.from({ length: 3 }, () => input())
  requests.forEach((r) => ledger.admit(r))
  ledger.reserve(requests[0].id, 2000)
  ledger.reserve(requests[1].id, 2000)
  expect(ledger.pending(2000)).toHaveLength(0)
  const settled = ledger.settle(requests[0].id, 3000)
  expect(settled.status).toBe('settled')
  expect(ledger.pending(3000)).toHaveLength(1)
  expect(ledger.acknowledge(requests[0].id, 70000)).toEqual(settled)
  expect(ledger.cancel(requests[0].id, 70000)).toEqual(settled)
  expect(new Delegations(sql).settle(requests[0].id, 70000)).toEqual(settled)
  expect(() => ledger.settle(requests[2].id, 3000)).toThrow(
    'unsettled child admission',
  )
  for (const patch of [
    { dispatchedAt: 999 },
    { dispatchedAt: 61000 },
    { admittedAt: 1000 },
    { settledAt: 1999 },
    { cancelledAt: 3000 },
    { settledAt: 3001 },
  ])
    expect(
      delegationRecordSchema.safeParse({ ...settled, ...patch }).success,
    ).toBe(false)
})

it('pages retained history by exact conversation with stable timestamp ties', () => {
  const { ledger, sql } = fixture()
  const base = input()
  const records = Array.from({ length: 6 }, (_, i) =>
    ledger.admit(
      input({
        parent: { ...base.parent, taskId: `history-${i}` },
        createdAt: 1000 + Math.floor(i / 2),
      }),
    ),
  )
  const expected = [...records]
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1))
    .map((r) => r.id)
  const first = ledger.history(base.parent.identity, { limit: 2 })
  expect(first.items.map((r) => r.id)).toEqual(expected.slice(0, 2))
  const restored = new Delegations(sql)
  const second = restored.history(base.parent.identity, {
    limit: 2,
    beforeId: first.nextBeforeId,
  })
  const third = restored.history(base.parent.identity, {
    limit: 2,
    beforeId: second.nextBeforeId,
  })
  expect(
    [...first.items, ...second.items, ...third.items].map((r) => r.id),
  ).toEqual(expected)
  expect(third.nextBeforeId).toBeUndefined()
  for (const field of [
    'workspaceId',
    'userId',
    'botId',
    'conversationId',
  ] as const) {
    const foreign = { ...base.parent.identity, [field]: 'other' }
    expect(restored.history(foreign).items).toEqual([])
    expect(() =>
      restored.history(foreign, { beforeId: first.nextBeforeId }),
    ).toThrow('cursor')
  }
  expect(() => ledger.history(base.parent.identity, { limit: 26 })).toThrow()
  expect(() =>
    ledger.history(base.parent.identity, { beforeId: crypto.randomUUID() }),
  ).toThrow('cursor')
})
