import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import type { DelegationParent } from '../../src/chat/core/delegation'
import {
  delegationBudgetLimits,
  type DelegationOperation,
} from '../../src/chat/core/delegation-budget'
import { DelegationBudget } from '../../src/chat/server/delegation-budget'
import { sqliteDoTransactions } from './fixtures/sqlite-do-storage'

const databases: DatabaseSync[] = []
afterEach(() => databases.splice(0).forEach((db) => db.close()))
const parent: DelegationParent = {
  identity: {
    workspaceId: 'w',
    userId: 'u',
    botId: 'b',
    conversationId: 'parent',
  },
  runId: 'run',
  taskId: 'task',
  epoch: 'epoch',
}
const initial = { modelPasses: 2, toolCalls: 3, repairs: 0 }
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
    budget: new DelegationBudget(sql),
    tx: sqliteDoTransactions(db).transactionSync,
  }
}
function op(
  id: string,
  delegationId: string | null = null,
  kind: DelegationOperation['kind'] = 'model',
): DelegationOperation {
  return { id, delegationId, kind, amount: 1 }
}

it('starts from consumed parent work and shares allowances across parent and children', () => {
  const h = fixture(),
    a = crypto.randomUUID(),
    b = crypto.randomUUID()
  h.tx(() => h.budget.open(parent, initial, 10))
  h.tx(() => h.budget.reserve(parent, op('parent/pass/3'), 20))
  h.tx(() => h.budget.reserve(parent, op('child-a/pass/1', a), 21))
  h.tx(() => h.budget.reserve(parent, op('child-b/pass/1', b), 22))
  h.tx(() => h.budget.reserve(parent, op('child-a/tool/1', a, 'tool'), 23))
  h.tx(() =>
    h.budget.reserve(parent, op('parent/repair/1', null, 'repair'), 24),
  )
  expect(h.budget.snapshot(parent)).toMatchObject({
    initial,
    used: { modelPasses: 5, toolCalls: 4, repairs: 1 },
    version: 6,
    createdAt: 10,
    updatedAt: 24,
  })
  expect(new DelegationBudget(h.sql).snapshot(parent)).toEqual(
    h.budget.snapshot(parent),
  )
})

it('replays the original reservation after lost acknowledgments without refunding or charging again', () => {
  const h = fixture(),
    operation = op('child/pass/1', crypto.randomUUID())
  h.tx(() => h.budget.open(parent, initial, 10))
  const first = h.tx(() => h.budget.reserve(parent, operation, 20))
  h.tx(() => h.budget.reserve(parent, op('parent/pass/3'), 21))
  const before = h.budget.snapshot(parent)
  const restored = new DelegationBudget(h.sql)
  expect(h.tx(() => restored.reserve(parent, operation, 999))).toEqual(first)
  expect(restored.snapshot(parent)).toEqual(before)
  expect(first.usedAfter.modelPasses).toBe(3)
})

it('does not allow changed operation identity, owner, kind or amount under an existing receipt', () => {
  const h = fixture(),
    operation = op('same', crypto.randomUUID())
  h.tx(() => h.budget.open(parent, initial, 10))
  h.tx(() => h.budget.reserve(parent, operation, 20))
  const before = h.budget.snapshot(parent)
  for (const change of [
    { kind: 'tool' as const },
    { delegationId: crypto.randomUUID() },
    { delegationId: null },
  ])
    expect(() =>
      h.tx(() => h.budget.reserve(parent, { ...operation, ...change }, 30)),
    ).toThrow('another request')
  for (const amount of [0, -1, 2, 0.5])
    expect(() =>
      h.tx(() => h.budget.reserve(parent, { ...operation, amount } as any, 30)),
    ).toThrow()
  expect(h.budget.snapshot(parent)).toEqual(before)
})

it.each([
  ['model', 'modelPasses'],
  ['tool', 'toolCalls'],
  ['repair', 'repairs'],
] as const)(
  'enforces the final shared %s slot before a different child can reserve another',
  (kind, field) => {
    const h = fixture()
    h.tx(() =>
      h.budget.open(
        parent,
        { ...initial, [field]: delegationBudgetLimits[field] - 1 },
        10,
      ),
    )
    const first = h.tx(() =>
      h.budget.reserve(parent, op('last', crypto.randomUUID(), kind), 20),
    )
    expect(first.usedAfter[field]).toBe(delegationBudgetLimits[field])
    expect(() =>
      h.tx(() =>
        h.budget.reserve(parent, op('over', crypto.randomUUID(), kind), 20),
      ),
    ).toThrow('shared task reached')
    expect(
      h.db
        .prepare('SELECT count(*) AS count FROM delegation_budget_operations')
        .get()?.count,
    ).toBe(1)
    expect(h.tx(() => h.budget.reserve(parent, first.operation, 21))).toEqual(
      first,
    )
  },
)

it('cannot reopen a task with reset counters, another epoch or another identity', () => {
  const h = fixture()
  const opened = h.tx(() => h.budget.open(parent, initial, 10))
  expect(h.tx(() => h.budget.open(parent, initial, 20))).toEqual(opened)
  expect(() =>
    h.tx(() => h.budget.open(parent, { ...initial, modelPasses: 0 }, 30)),
  ).toThrow('cannot change')
  for (const altered of [
    { ...parent, epoch: 'reset' },
    { ...parent, runId: 'replacement' },
    ...['workspaceId', 'userId', 'botId', 'conversationId'].map((field) => ({
      ...parent,
      identity: { ...parent.identity, [field]: 'other' },
    })),
  ]) {
    expect(h.budget.snapshot(altered)).toBeUndefined()
    expect(() => h.tx(() => h.budget.open(altered, initial, 30))).toThrow(
      'another identity',
    )
    expect(() => h.tx(() => h.budget.reserve(altered, op('new'), 30))).toThrow(
      'unavailable',
    )
  }
})

it('separates new tasks in the same conversation without giving the old task new capacity', () => {
  const h = fixture(),
    next = { ...parent, taskId: 'next-task', runId: 'next-run' }
  h.tx(() => h.budget.open(parent, initial, 10))
  h.tx(() => h.budget.reserve(parent, op('one'), 20))
  h.tx(() =>
    h.budget.open(next, { modelPasses: 0, toolCalls: 0, repairs: 0 }, 30),
  )
  h.tx(() => h.budget.reserve(next, op('one'), 40))
  expect(h.budget.snapshot(parent)?.used.modelPasses).toBe(3)
  expect(h.budget.snapshot(next)?.used.modelPasses).toBe(1)
})

it('accepts exhausted initial counts but rejects counts beyond the fixed host limits', () => {
  const h = fixture()
  h.tx(() => h.budget.open(parent, { ...delegationBudgetLimits }, 10))
  for (const kind of ['model', 'tool', 'repair'] as const)
    expect(() =>
      h.tx(() => h.budget.reserve(parent, op(kind, null, kind), 20)),
    ).toThrow('shared task reached')
  for (const field of ['modelPasses', 'toolCalls', 'repairs'] as const) {
    const other = { ...parent, taskId: field, runId: field }
    expect(() =>
      h.tx(() =>
        h.budget.open(
          other,
          { ...initial, [field]: delegationBudgetLimits[field] + 1 },
          20,
        ),
      ),
    ).toThrow()
    expect(h.budget.snapshot(other)).toBeUndefined()
  }
})

it('commits receipt and counters atomically and preserves reservations through transcript deletion', () => {
  const h = fixture(),
    operation = op('one')
  h.tx(() => h.budget.open(parent, initial, 10))
  h.db.exec(`CREATE TRIGGER fail_budget BEFORE UPDATE ON delegation_budgets
    BEGIN SELECT RAISE(ABORT, 'synthetic budget failure'); END`)
  expect(() => h.tx(() => h.budget.reserve(parent, operation, 20))).toThrow(
    'synthetic budget failure',
  )
  expect(
    h.db
      .prepare('SELECT count(*) AS count FROM delegation_budget_operations')
      .get()?.count,
  ).toBe(0)
  expect(h.budget.snapshot(parent)?.used).toEqual(initial)
  h.db.exec('DROP TRIGGER fail_budget')
  h.tx(() => h.budget.reserve(parent, operation, 30))
  h.db.exec('CREATE TABLE state(json TEXT); DELETE FROM state')
  expect(new DelegationBudget(h.sql).snapshot(parent)?.used.modelPasses).toBe(3)
})

it('rejects backward mutation time and invalid operation input before reserving capacity', () => {
  const h = fixture()
  h.tx(() => h.budget.open(parent, initial, 10))
  for (const input of [
    op(''),
    op('x'.repeat(201)),
    { ...op('one'), extra: true },
    { ...op('one'), delegationId: 'invalid' },
  ])
    expect(() => h.tx(() => h.budget.reserve(parent, input, 20))).toThrow()
  expect(() => h.tx(() => h.budget.reserve(parent, op('one'), 9))).toThrow(
    'backward',
  )
  expect(h.budget.snapshot(parent)?.used).toEqual(initial)
})
