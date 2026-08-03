import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import {
  defineWorkflowRuntime,
  every,
  inMemoryWorkflowExecutionStore,
  materializeWorkflowSchedules,
} from '@tanstack/workflow-runtime'
import type { WorkflowExecutionStore } from '@tanstack/workflow-runtime'
import { createIntentProcessWorkflow } from '../src/utils/intent-workflows.server'
import type {
  IntentProcessResult,
  IntentSyncOperations,
  IntentVersionProcessResult,
} from '../src/utils/intent-sync.server'

test('duplicate scheduled invocation with the same bucket is idempotent', async () => {
  let selectCalls = 0
  let processCalls = 0
  const store = inMemoryWorkflowExecutionStore()
  const { processSchedule, processWorkflow, runtime } = createTestIntentRuntime(
    {
      store,
      operations: {
        ...noopOperations,
        selectPendingIntentVersions: async () => {
          selectCalls++
          return [{ id: 1, packageName: '@example/pkg', version: '1.0.0' }]
        },
        processIntentVersion: async () => {
          processCalls++
          return {
            packageName: '@example/pkg',
            version: '1.0.0',
            status: 'synced',
            skillCount: 1,
          }
        },
      },
    },
  )
  const now = Date.UTC(2026, 4, 26, 12, 0, 0)

  await materializeWorkflowSchedules(runtime, { now })
  const first = await runtime.sweep({ now, includeEvents: false })
  await materializeWorkflowSchedules(runtime, { now })
  const second = await runtime.sweep({ now, includeEvents: false })

  const processRun = first.scheduled.find(
    (run) => run.workflowId === processWorkflow.id,
  )
  assert.ok(processRun)
  assert.equal(
    processRun.runId,
    `${processWorkflow.id}:${processSchedule.id}:${now}`,
  )
  assert.equal(second.scheduled.length, 0)
  assert.equal(selectCalls, 1)
  assert.equal(processCalls, 1)
})

test('failed package version step does not prevent other versions from processing', async () => {
  const goodResult: IntentVersionProcessResult = {
    packageName: '@example/good',
    version: '1.0.0',
    status: 'synced',
    skillCount: 1,
  }
  const badResult: IntentVersionProcessResult = {
    packageName: '@example/bad',
    version: '1.0.0',
    status: 'failed',
    error: 'tarball failed',
  }
  const laterResult: IntentVersionProcessResult = {
    packageName: '@example/later',
    version: '1.0.0',
    status: 'synced',
    skillCount: 2,
  }
  const expected: IntentProcessResult = {
    processed: 2,
    failed: 1,
    deferred: 0,
    results: [goodResult, badResult, laterResult],
  }
  const { processWorkflow, runtime } = createTestIntentRuntime({
    store: inMemoryWorkflowExecutionStore(),
    operations: {
      ...noopOperations,
      selectPendingIntentVersions: async () => [
        { id: 1, packageName: '@example/good', version: '1.0.0' },
        { id: 2, packageName: '@example/bad', version: '1.0.0' },
        { id: 3, packageName: '@example/later', version: '1.0.0' },
      ],
      processIntentVersion: async (versionId: number) => {
        if (versionId === 1) return goodResult
        if (versionId === 2) throw new Error('tarball failed')
        return laterResult
      },
    },
  })

  const result = await runtime.startRun({
    workflowId: processWorkflow.id,
    runId: 'intent-process:test-partial-failure',
    input: { source: 'admin' },
    now: Date.UTC(2026, 4, 26, 12, 15, 0),
    includeEvents: false,
  })

  assert.equal(result.kind, 'completed')
  assert.ok(result.run)
  assert.deepEqual(result.run.output, expected)
})

test('process workflow yields near its runtime deadline and resumes the same run', async () => {
  let wallNow = 1_000
  mock.method(Date, 'now', () => wallNow)

  try {
    const queue = [
      { id: 1, packageName: '@example/one', version: '1.0.0' },
      { id: 2, packageName: '@example/two', version: '1.0.0' },
    ]
    const processed: Array<string> = []
    const store = inMemoryWorkflowExecutionStore()
    const { processWorkflow, runtime } = createTestIntentRuntime({
      store,
      operations: {
        ...noopOperations,
        selectPendingIntentVersions: async ({ limit }) =>
          queue.splice(0, limit),
        processIntentVersion: async (versionId: number) => {
          const packageName = versionId === 1 ? '@example/one' : '@example/two'
          const version = '1.0.0'
          processed.push(`${packageName}@${version}`)
          wallNow += 600
          return {
            packageName,
            version,
            status: 'synced',
            skillCount: 1,
          }
        },
      },
    })
    const runId = 'intent-process:deadline-resume'

    const first = await runtime.startRun({
      workflowId: processWorkflow.id,
      runId,
      input: { source: 'schedule' },
      now: 100,
      deadline: 2_000,
      minYieldRemainingMs: 500,
      includeEvents: false,
    })
    const paused = await store.loadRun(runId)
    const resumed = await runtime.sweep({
      now: 101,
      deadline: 10_000,
      minYieldRemainingMs: 500,
      includeEvents: false,
    })

    assert.equal(first.kind, 'paused')
    assert.equal(paused?.status, 'paused')
    assert.equal(paused?.lease, undefined)
    assert.equal(resumed.timers[0]?.kind, 'completed')
    assert.equal(resumed.timers[0]?.runId, runId)
    assert.deepEqual(processed, ['@example/one@1.0.0', '@example/two@1.0.0'])
    assert.deepEqual(resumed.timers[0]?.run?.output, {
      processed: 2,
      failed: 0,
      deferred: 0,
      results: [
        {
          packageName: '@example/one',
          version: '1.0.0',
          status: 'synced',
          skillCount: 1,
        },
        {
          packageName: '@example/two',
          version: '1.0.0',
          status: 'synced',
          skillCount: 1,
        },
      ],
    })
  } finally {
    mock.restoreAll()
  }
})

const noopOperations: IntentSyncOperations = {
  discoverIntentPackages: async () => ({
    packagesDiscovered: 0,
    githubCandidates: 0,
    packagesVerified: 0,
    versionsEnqueued: 0,
    errors: [],
  }),
  selectPendingIntentVersions: async () => [],
  processIntentVersion: async () => {
    throw new Error('No test version configured')
  },
}

function createTestIntentRuntime(options: {
  operations: IntentSyncOperations
  store?: WorkflowExecutionStore
}) {
  const processWorkflow = createIntentProcessWorkflow(options.operations)
  const processSchedule = {
    id: 'intent-process-every-15m',
    schedule: every.minutes(15),
    overlapPolicy: 'skip',
    input: {
      source: 'schedule',
    },
  } as const

  return {
    processSchedule,
    processWorkflow,
    runtime: defineWorkflowRuntime({
      store: options.store ?? inMemoryWorkflowExecutionStore(),
      workflows: {
        [processWorkflow.id]: {
          load: async () => processWorkflow,
          schedules: [processSchedule],
        },
      },
    }),
  }
}
