import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import { WorkflowRuns } from '../../src/chat/server/workflow-runs'
import {
  readyWorkflowSteps,
  workflowRunStatus,
  type WorkflowRunRequest,
} from '../../src/chat/core/workflow-runs'
const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})
function fixture() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  // Production SqlStorage executes eagerly, including statements whose cursor is unused.
  const eager = {
    exec(query: string, ...args: any[]) {
      const statement = db.prepare(query)
      const rows = statement.columns().length
        ? statement.all(...args)
        : (statement.run(...args), [])
      return { toArray: () => rows }
    },
  } as unknown as SqlStorage
  return { db, sql: eager, store: new WorkflowRuns(eager) }
}
function request(): WorkflowRunRequest {
  const step = (id: string, dependsOn: string[] = []) => ({
    id,
    name: id,
    objective: id,
    dependsOn,
    inputs: [],
    failure: 'stop' as const,
  })
  return {
    id: crypto.randomUUID(),
    workflowId: crypto.randomUUID(),
    definitionRevision: 1,
    definition: {
      version: 1,
      name: 'Parallel review',
      steps: [step('join', ['a', 'b']), step('a'), step('b')],
    },
    scope: { workspaceId: 'w', userId: 'u', botId: 'b', conversationId: 'c' },
    model: { provider: 'cloudflare', model: '@cf/moonshotai/kimi-k2.6' },
    sources: [],
    operationLimits: { model: 24, tool: 48, repair: 8 },
    triggerId: 'manual-request',
    createdAt: 1,
    deadline: 1000,
    concurrency: 2,
  }
}
it('pins a definition, admits parallel roots once and unlocks the join only after both results', () => {
  const { store, sql } = fixture()
  const input = request()
  expect(readyWorkflowSteps(store.create(input))).toEqual(['a', 'b'])
  const a = crypto.randomUUID(),
    b = crypto.randomUUID(),
    join = crypto.randomUUID()
  store.claim(input.id, 'a', a, 2)
  expect(() => store.claim(input.id, 'join', join, 2)).toThrow('not ready')
  store.claim(input.id, 'b', b, 2)
  expect(readyWorkflowSteps(new WorkflowRuns(sql).get(input.id)!)).toEqual([])
  store.settle(
    input.id,
    'a',
    a,
    { status: 'completed', resultId: 'answer-a' },
    3,
  )
  expect(readyWorkflowSteps(store.get(input.id)!)).toEqual([])
  store.settle(
    input.id,
    'b',
    b,
    { status: 'completed', resultId: 'answer-b' },
    4,
  )
  expect(readyWorkflowSteps(store.get(input.id)!)).toEqual(['join'])
  store.claim(input.id, 'join', join, 5)
  expect(
    workflowRunStatus(
      store.settle(
        input.id,
        'join',
        join,
        { status: 'completed', resultId: 'answer-join' },
        6,
      ),
    ),
  ).toBe('completed')
  expect(store.get(input.id)!.request.definitionRevision).toBe(1)
})
it('preserves dispatch on reconstruction and rejects changed admissions and results', () => {
  const { store, sql } = fixture()
  const input = request(),
    execution = crypto.randomUUID()
  store.create(input)
  const admitted = store.claim(input.id, 'a', execution, 2)
  const restored = new WorkflowRuns(sql)
  expect(restored.claim(input.id, 'a', execution, 3)).toEqual(admitted)
  expect(() => restored.claim(input.id, 'a', crypto.randomUUID(), 3)).toThrow(
    'not ready',
  )
  expect(() => restored.claim(input.id, 'b', execution, 3)).toThrow(
    'another step',
  )
  expect(() =>
    restored.settle(
      input.id,
      'b',
      execution,
      { status: 'completed', resultId: 'wrong' },
      3,
    ),
  ).toThrow('does not match')
  const result = { status: 'completed' as const, resultId: 'saved' }
  const completed = restored.settle(input.id, 'a', execution, result, 4)
  expect(restored.settle(input.id, 'a', execution, result, 5)).toEqual(
    completed,
  )
  expect(() =>
    restored.settle(
      input.id,
      'a',
      execution,
      { ...result, resultId: 'changed' },
      5,
    ),
  ).toThrow('already recorded')
})
it('does not pretend active work stopped after cancellation or deadline', () => {
  for (const reason of ['user', 'deadline'] as const) {
    const { store } = fixture()
    const input = request(),
      execution = crypto.randomUUID()
    store.create(input)
    store.claim(input.id, 'a', execution, 2)
    const now = reason === 'deadline' ? 1000 : 3
    const cancelling = store.cancel(input.id, reason, now)
    expect(workflowRunStatus(cancelling)).toBe('cancelling')
    expect(readyWorkflowSteps(cancelling)).toEqual([])
    expect(cancelling.steps.find((step) => step.id === 'a')!.status).toBe(
      'dispatched',
    )
    expect(() => store.claim(input.id, 'b', crypto.randomUUID(), now)).toThrow()
    expect(
      workflowRunStatus(
        store.settle(
          input.id,
          'a',
          execution,
          { status: 'completed', resultId: 'late-result' },
          now + 1,
        ),
      ),
    ).toBe('cancelled')
    expect(
      store.get(input.id)!.steps.find((step) => step.id === 'a')!.result,
    ).toEqual({ status: 'completed', resultId: 'late-result' })
  }
})
it('blocks pending work after failure and waits for the active sibling to settle', () => {
  const { store } = fixture()
  const input = request(),
    a = crypto.randomUUID(),
    b = crypto.randomUUID()
  store.create(input)
  store.claim(input.id, 'a', a, 2)
  store.claim(input.id, 'b', b, 2)
  expect(
    workflowRunStatus(
      store.settle(
        input.id,
        'a',
        a,
        { status: 'failed', reason: 'Source unavailable' },
        3,
      ),
    ),
  ).toBe('stopping')
  expect(readyWorkflowSteps(store.get(input.id)!)).toEqual([])
  expect(
    workflowRunStatus(
      store.settle(
        input.id,
        'b',
        b,
        { status: 'cancelled', reason: 'Sibling failed' },
        4,
      ),
    ),
  ).toBe('failed')
})
it('deduplicates exact triggers and rejects changed revision or identity reuse', () => {
  const { store } = fixture()
  const input = request(),
    first = store.create(input)
  expect(store.create(input)).toEqual(first)
  for (const patch of [
    { id: crypto.randomUUID() },
    { definitionRevision: 2 },
    { triggerId: 'different' },
    { scope: { ...input.scope, userId: 'other' } },
  ])
    expect(() => store.create({ ...input, ...patch })).toThrow(
      'different run request',
    )
})
it('enforces concurrency and deadline without dispatching another step', () => {
  const { store } = fixture()
  const input = { ...request(), concurrency: 1 }
  store.create(input)
  store.claim(input.id, 'a', crypto.randomUUID(), 2)
  expect(() => store.claim(input.id, 'b', crypto.randomUUID(), 2)).toThrow(
    'not ready',
  )
  expect(() => store.cancel(input.id, 'deadline', 3)).toThrow(
    'not been reached',
  )
  expect(() => store.claim(input.id, 'b', crypto.randomUUID(), 1000)).toThrow(
    'deadline',
  )
})

it('rolls back admission with a failed host transaction before external dispatch', () => {
  const { db, store, sql } = fixture()
  const input = request(),
    execution = crypto.randomUUID()
  store.create(input)
  db.exec('BEGIN')
  try {
    store.claim(input.id, 'a', execution, 2)
    throw Error('Synthetic child dispatch record failure')
  } catch {
    db.exec('ROLLBACK')
  }
  const restored = new WorkflowRuns(sql).get(input.id)!
  expect(restored.steps.find((step) => step.id === 'a')).toEqual({
    id: 'a',
    status: 'pending',
  })
  expect(readyWorkflowSteps(restored)).toEqual(['a', 'b'])
})

it('pins only declared predecessor outputs and retains them across recovery and cancellation', () => {
  const { store, sql } = fixture()
  const input = request()
  input.definition.steps[0].inputs = [
    { name: 'source-files', fromStep: 'b', output: 'files' },
    { name: 'summary', fromStep: 'a', output: 'answer' },
  ]
  store.create(input)
  const a = crypto.randomUUID(),
    b = crypto.randomUUID(),
    join = crypto.randomUUID()
  store.claim(input.id, 'a', a, 2)
  store.claim(input.id, 'b', b, 2)
  store.settle(
    input.id,
    'a',
    a,
    { status: 'completed', resultId: 'a-result' },
    3,
  )
  expect(() => store.claim(input.id, 'join', join, 3)).toThrow('not ready')
  expect(store.get(input.id)!.steps[0].inputs).toBeUndefined()
  store.settle(
    input.id,
    'b',
    b,
    { status: 'completed', resultId: 'b-result' },
    4,
  )
  const claimed = store.claim(input.id, 'join', join, 5)
  const expected = [
    {
      name: 'source-files',
      fromStep: 'b',
      output: 'files',
      executionId: b,
      resultId: 'b-result',
    },
    {
      name: 'summary',
      fromStep: 'a',
      output: 'answer',
      executionId: a,
      resultId: 'a-result',
    },
  ]
  expect(claimed.steps[0].inputs).toEqual(expected)
  const recovered = new WorkflowRuns(sql)
  expect(recovered.claim(input.id, 'join', join, 6).steps[0].inputs).toEqual(
    expected,
  )
  expect(recovered.cancel(input.id, 'user', 7).steps[0].inputs).toEqual(
    expected,
  )
})

it('does not implicitly pass outputs from dependencies without named inputs', () => {
  const { store } = fixture()
  const input = request()
  store.create(input)
  for (const id of ['a', 'b']) {
    const execution = crypto.randomUUID()
    store.claim(input.id, id, execution, 3)
    store.settle(
      input.id,
      id,
      execution,
      { status: 'completed', resultId: `${id}-private-result` },
      3,
    )
  }
  const joined = store.claim(input.id, 'join', crypto.randomUUID(), 4)
  expect(joined.steps[0].inputs).toEqual([])
})

it('atomically pins a step dispatch to its owner, model, objective and exact child', () => {
  const { store, sql } = fixture()
  const input = request()
  const execution = crypto.randomUUID()
  store.create(input)
  const claimed = store.claim(input.id, 'a', execution, 2)
  const admission = claimed.steps.find((step) => step.id === 'a')!.admission!
  expect(admission).toEqual({
    id: execution,
    workflowRunId: input.id,
    workflowId: input.workflowId,
    definitionRevision: 1,
    stepId: 'a',
    owner: input.scope,
    childConversationId: execution,
    objective: 'a',
    model: input.model,
    sources: [],
    inputs: [],
    createdAt: 2,
    deadline: 1000,
  })
  // A later model preference or changed trigger cannot rewrite a dispatched step.
  expect(() =>
    store.create({ ...input, model: { ...input.model, model: 'different' } }),
  ).toThrow('different run request')
  const recovered = new WorkflowRuns(sql)
  expect(
    recovered
      .claim(input.id, 'a', execution, 1001)
      .steps.find((step) => step.id === 'a')!.admission,
  ).toEqual(admission)
  expect(
    recovered
      .cancel(input.id, 'deadline', 1001)
      .steps.find((step) => step.id === 'a')!.admission,
  ).toEqual(admission)
})

it('rejects a child identity collision before persisting a step claim', () => {
  const { store } = fixture()
  const input = request()
  input.scope.conversationId = crypto.randomUUID()
  store.create(input)
  expect(() =>
    store.claim(input.id, 'a', input.scope.conversationId, 2),
  ).toThrow('Invalid workflow admission')
  expect(store.get(input.id)!.steps.find((step) => step.id === 'a')).toEqual({
    id: 'a',
    status: 'pending',
  })
})

it('checks the exact admission and withdraws liveness after cancellation, failure or expiry', () => {
  for (const stop of ['cancel', 'failure', 'deadline', 'complete'] as const) {
    const { store, sql } = fixture()
    const input = request()
    store.create(input)
    const a = crypto.randomUUID(),
      b = crypto.randomUUID()
    const admitted = store
      .claim(input.id, 'a', a, 2)
      .steps.find((step) => step.id === 'a')!.admission!
    store.claim(input.id, 'b', b, 2)
    expect(store.activeAdmission(admitted, 3)).toEqual(admitted)
    expect(() =>
      store.activeAdmission({ ...admitted, objective: 'Changed objective' }, 3),
    ).toThrow('does not match')
    expect(() =>
      store.activeAdmission(
        { ...admitted, owner: { ...admitted.owner, userId: 'other' } },
        3,
      ),
    ).toThrow('does not match')
    if (stop === 'cancel') store.cancel(input.id, 'user', 4)
    if (stop === 'failure')
      store.settle(
        input.id,
        'b',
        b,
        { status: 'failed', reason: 'Source failed' },
        4,
      )
    if (stop === 'complete')
      store.settle(
        input.id,
        'a',
        a,
        { status: 'completed', resultId: 'answer' },
        4,
      )
    const restored = new WorkflowRuns(sql)
    expect(() =>
      restored.activeAdmission(admitted, stop === 'deadline' ? 1000 : 5),
    ).toThrow()
    // A retained receipt can still be inspected without granting new work.
    expect(
      restored.get(input.id)!.steps.find((step) => step.id === 'a')!.admission,
    ).toEqual(admitted)
  }
})

it('shares operation allowances across children and counts replayed reservations once', () => {
  const { store, sql } = fixture()
  const input = request()
  input.operationLimits = { model: 2, tool: 1, repair: 0 }
  store.create(input)
  const a = crypto.randomUUID(),
    b = crypto.randomUUID()
  const first = store
    .claim(input.id, 'a', a, 2)
    .steps.find((step) => step.id === 'a')!.admission!
  const second = store
    .claim(input.id, 'b', b, 2)
    .steps.find((step) => step.id === 'b')!.admission!
  const operation = { id: 'model-a', executionId: a, kind: 'model' as const }
  const receipt = store.reserve(first, operation, 3)
  const restored = new WorkflowRuns(sql)
  expect(restored.reserve(first, operation, 4)).toEqual(receipt)
  restored.reserve(second, { id: 'model-b', executionId: b, kind: 'model' }, 4)
  expect(() =>
    restored.reserve(first, { ...operation, id: 'third' }, 5),
  ).toThrow('shared model limit')
  expect(() =>
    restored.reserve(second, { ...operation, executionId: b }, 5),
  ).toThrow('different request')
  expect(() =>
    restored.reserve(first, { ...operation, executionId: b }, 5),
  ).toThrow('another execution')
  expect(() =>
    restored.reserve(first, { ...operation, id: 'repair', kind: 'repair' }, 5),
  ).toThrow('shared repair limit')
  restored.reserve(second, { id: 'tool-b', executionId: b, kind: 'tool' }, 5)
  expect(restored.get(input.id)!.operations).toHaveLength(3)
  restored.cancel(input.id, 'user', 6)
  expect(() => restored.reserve(first, operation, 7)).toThrow(
    'no longer active',
  )
  expect(restored.get(input.id)!.operations).toHaveLength(3)
})

it('rolls back a reservation with the host transaction and refuses changed run limits', () => {
  const { store, db, sql } = fixture()
  const input = request()
  store.create(input)
  const execution = crypto.randomUUID()
  const admission = store
    .claim(input.id, 'a', execution, 2)
    .steps.find((step) => step.id === 'a')!.admission!
  const operation = {
    id: 'attempt',
    executionId: execution,
    kind: 'model' as const,
  }
  db.exec('BEGIN')
  store.reserve(admission, operation, 3)
  db.exec('ROLLBACK')
  const restored = new WorkflowRuns(sql)
  expect(restored.get(input.id)!.operations).toEqual([])
  restored.reserve(admission, operation, 3)
  expect(restored.get(input.id)!.operations).toHaveLength(1)
  expect(() =>
    restored.create({
      ...input,
      operationLimits: { ...input.operationLimits, model: 25 },
    }),
  ).toThrow('different run request')
})

function startCommand(input: WorkflowRunRequest) {
  return {
    commandId: input.id,
    workflowId: input.workflowId,
    revision: input.definitionRevision,
    model: input.model,
    references: [],
    concurrency: input.concurrency,
    durationMs: 60_000,
    operationLimits: input.operationLimits,
  }
}
it('withdrawal survives reconstruction and fences a delayed admission', () => {
  const { store, sql } = fixture()
  const input = request()
  const command = startCommand(input)
  // A request can have finished asynchronous validation before withdrawal.
  expect(store.started(command)).toBeUndefined()
  expect(store.withdrawStart(command)).toEqual({ status: 'withdrawn' })
  const restored = new WorkflowRuns(sql)
  expect(restored.withdrawStart(command)).toEqual({ status: 'withdrawn' })
  expect(() => restored.start(command, input)).toThrow('withdrawn')
  expect(restored.get(input.id)).toBeUndefined()
  expect(() => restored.withdrawStart({ ...command, revision: 2 })).toThrow(
    'different input',
  )
  expect(() => restored.start({ ...command, revision: 2 }, input)).toThrow(
    'different input',
  )
})
it('withdrawal reports an already admitted run without cancelling or deleting it', () => {
  const { store, sql } = fixture()
  const input = request()
  const command = startCommand(input)
  const run = store.start(command, input)
  const restored = new WorkflowRuns(sql)
  expect(restored.withdrawStart(command)).toEqual({
    status: 'admitted',
    runId: input.id,
  })
  expect(restored.start(command, input)).toEqual(run)
  expect(restored.get(input.id)).toEqual(run)
  expect(() => restored.withdrawStart({ ...command, revision: 2 })).toThrow(
    'different input',
  )
})
