import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import { newAssistantTask } from '../../src/chat/core/assistant-task'
import type { AcceptConversationRun } from '../../src/chat/core/conversation-runs'
import { ConversationRuns } from '../../src/chat/server/conversation-runs'
import { projectConversationRuns } from '../../src/chat/server/conversation-run-projection'

const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})
const identity = {
  workspaceId: 'w',
  userId: 'u',
  botId: 'b',
  conversationId: 'c',
}
function fixture(kind: 'schedule' | 'delegation' = 'schedule') {
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
  const runs = new ConversationRuns(sql)
  const occurrenceId = crypto.randomUUID()
  const run: AcceptConversationRun = {
    id: occurrenceId,
    identity,
    origin:
      kind === 'schedule'
        ? {
            kind: 'schedule',
            scheduleId: crypto.randomUUID(),
            revision: 1,
            occurrenceId,
          }
        : {
            kind: 'delegation',
            delegationId: occurrenceId,
            parentConversationId: 'parent-conversation',
            parentRunId: 'parent-run',
            parentTaskId: 'parent-task',
            parentEpoch: 'parent-epoch',
          },
    mode: 'assistant',
    status: 'running',
    createdAt: 1,
  }
  runs.accept(run)
  return { runs, run, sql }
}
type RunState = Parameters<typeof projectConversationRuns>[1]
function state(overrides: Partial<RunState> = {}): RunState {
  return {
    messages: [],
    status: 'idle',
    activeRun: null,
    approvals: [],
    ...overrides,
  }
}

it('projects a scheduled run without a human transcript message and matches its stable task and timing', () => {
  const { runs, run } = fixture()
  const task = newAssistantTask('Scheduled request', run.id)
  projectConversationRuns(
    runs,
    state({
      currentRunId: run.id,
      status: 'running',
      activeRun: 'execution',
      assistantTask: task,
      turnTimings: { [run.id]: { startedAt: 2 } },
    }),
    3,
  )
  expect(runs.get(run.id)).toMatchObject({
    status: 'running',
    startedAt: 2,
    assistantTaskId: task.id,
    executionId: 'execution',
  })
  projectConversationRuns(
    runs,
    state({
      currentRunId: run.id,
      assistantTask: { ...task, status: 'incomplete' },
      turnTimings: { [run.id]: { startedAt: 2, completedAt: 4 } },
    }),
    5,
  )
  expect(runs.get(run.id)).toMatchObject({
    status: 'incomplete',
    completedAt: 4,
  })
})

it('ignores an unrelated human message, task, approvals and timing when projecting the current scheduled run', () => {
  const { runs, run } = fixture()
  projectConversationRuns(
    runs,
    state({
      currentRunId: run.id,
      messages: [
        {
          id: 'human',
          role: 'user',
          parts: [{ type: 'text', content: 'Older human request' }],
        },
      ],
      assistantTask: {
        ...newAssistantTask('Older request', 'human'),
        status: 'interrupted',
      },
      approvals: [
        {
          id: 'old-approval',
          title: 'Old approval',
          code: '',
          status: 'pending',
          messageId: 'human',
        },
      ],
      turnTimings: { human: { startedAt: 10, completedAt: 20 } },
      runOutcome: { runId: run.id, status: 'completed' },
    }),
    30,
  )
  expect(runs.get(run.id)).toMatchObject({
    status: 'completed',
    completedAt: 30,
  })
  expect(runs.get(run.id)?.assistantTaskId).toBeUndefined()
  expect(runs.get(run.id)?.startedAt).toBeUndefined()
})

it.each(['message', 'task'] as const)(
  'matches scheduled approvals by stable %s ID',
  (association) => {
    const { runs, run } = fixture()
    const task = newAssistantTask('Scheduled request', run.id)
    projectConversationRuns(
      runs,
      state({
        currentRunId: run.id,
        assistantTask: task,
        approvals: [
          {
            id: 'approval',
            title: 'Scheduled approval',
            code: '',
            status: 'pending',
            ...(association === 'message'
              ? { messageId: run.id }
              : { assistantTaskId: task.id }),
          },
        ],
      }),
      2,
    )
    expect(runs.get(run.id)?.status).toBe('waiting_approval')
  },
)

it('cancels removed scheduled queue items without a transcript and preserves scheduled items still in the queue', () => {
  const { runs, run } = fixture()
  const queuedId = crypto.randomUUID()
  const removedId = crypto.randomUUID()
  for (const id of [queuedId, removedId])
    runs.accept({
      ...run,
      id,
      status: 'queued',
      origin: {
        ...(run.origin as Extract<typeof run.origin, { kind: 'schedule' }>),
        occurrenceId: id,
      },
    })
  projectConversationRuns(
    runs,
    state({
      currentRunId: run.id,
      status: 'running',
      queue: { items: [{ messageId: queuedId }] },
    }),
    2,
  )
  expect(runs.get(run.id)?.status).toBe('running')
  expect(runs.get(queuedId)?.status).toBe('queued')
  expect(runs.get(removedId)).toMatchObject({
    status: 'cancelled',
    completedAt: 2,
  })
})

it('uses an explicit current run ID instead of falling back to another admitted human run', () => {
  const { runs, run } = fixture()
  runs.accept({
    ...run,
    id: 'human',
    origin: { kind: 'user', messageId: 'human' },
  })
  projectConversationRuns(
    runs,
    state({
      currentRunId: 'missing',
      messages: [{ id: 'human', role: 'user', parts: [] }],
    }),
    2,
  )
  expect(runs.get('human')?.status).toBe('running')
  expect(runs.get(run.id)?.status).toBe('running')
})

it('retains legacy human projection and never creates an admission from inherited history', () => {
  const { runs, run } = fixture()
  runs.accept({
    ...run,
    id: 'human',
    origin: { kind: 'user', messageId: 'human' },
  })
  projectConversationRuns(
    runs,
    state({
      messages: [{ id: 'human', role: 'user', parts: [] }],
      runOutcome: { runId: 'human', status: 'completed' },
    }),
    2,
  )
  expect(runs.get('human')?.status).toBe('completed')
  projectConversationRuns(
    runs,
    state({
      messages: [
        {
          id: 'inherited',
          role: 'user',
          parts: [],
          metadata: { gumInherited: true },
        },
      ],
    }),
    3,
  )
  expect(runs.has('inherited')).toBe(false)
})

it('projects a delegated child through approval and continuation after reconstruction without inheriting parent approvals', () => {
  const { runs, run, sql } = fixture('delegation')
  const task = newAssistantTask('Delegated request', run.id)
  const origin = run.origin
  if (origin.kind !== 'delegation') throw new Error('Expected delegation')
  const parentApproval = {
    id: 'parent-approval',
    title: 'Parent approval',
    code: '',
    status: 'pending' as const,
    messageId: origin.parentRunId,
    assistantTaskId: origin.parentTaskId,
  }
  projectConversationRuns(
    runs,
    state({
      currentRunId: run.id,
      status: 'running',
      activeRun: 'child-execution-1',
      assistantTask: task,
      approvals: [parentApproval],
      turnTimings: { [run.id]: { startedAt: 2 } },
    }),
    3,
  )
  projectConversationRuns(
    runs,
    state({
      currentRunId: run.id,
      assistantTask: task,
      approvals: [
        parentApproval,
        {
          id: 'child-approval',
          title: 'Child approval',
          code: '',
          status: 'pending',
          assistantTaskId: task.id,
        },
      ],
    }),
    4,
  )
  expect(runs.get(run.id)).toMatchObject({
    origin,
    status: 'waiting_approval',
    startedAt: 2,
    assistantTaskId: task.id,
  })
  const restored = new ConversationRuns(sql)
  projectConversationRuns(
    restored,
    state({
      currentRunId: run.id,
      status: 'running',
      activeRun: 'child-execution-2',
      assistantTask: task,
    }),
    5,
  )
  projectConversationRuns(
    restored,
    state({
      currentRunId: run.id,
      assistantTask: { ...task, status: 'answered' },
      approvals: [parentApproval],
      runOutcome: { runId: run.id, status: 'completed' },
      turnTimings: { [run.id]: { startedAt: 2, completedAt: 6 } },
    }),
    7,
  )
  const completed = restored.get(run.id)
  expect(completed).toMatchObject({
    origin,
    status: 'completed',
    startedAt: 2,
    completedAt: 6,
    assistantTaskId: task.id,
    executionId: 'child-execution-2',
  })
  // A later transcript reset cannot erase or reinterpret the settled receipt.
  projectConversationRuns(restored, state(), 8)
  expect(restored.get(run.id)).toEqual(completed)
  expect(restored.has(origin.parentRunId)).toBe(false)
})

it('cancels removed delegated admissions but never creates one from copied provenance', () => {
  const { runs, run } = fixture('delegation')
  if (run.origin.kind !== 'delegation') throw new Error('Expected delegation')
  const removedId = crypto.randomUUID()
  const retainedId = crypto.randomUUID()
  for (const id of [removedId, retainedId])
    runs.accept({
      ...run,
      id,
      status: 'queued',
      origin: { ...run.origin, delegationId: id },
    })
  const copiedId = crypto.randomUUID()
  projectConversationRuns(
    runs,
    state({
      currentRunId: run.id,
      status: 'running',
      queue: { items: [{ messageId: retainedId }] },
      messages: [
        {
          id: copiedId,
          role: 'user',
          parts: [],
          metadata: {
            gumInherited: true,
            gumOrigin: { ...run.origin, delegationId: copiedId },
          },
        },
      ],
    }),
    2,
  )
  expect(runs.get(run.id)?.status).toBe('running')
  expect(runs.get(retainedId)?.status).toBe('queued')
  expect(runs.get(removedId)).toMatchObject({
    status: 'cancelled',
    completedAt: 2,
  })
  expect(runs.has(copiedId)).toBe(false)
})
