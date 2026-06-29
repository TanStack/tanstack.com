import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defineWorkflowRuntime,
  inMemoryWorkflowExecutionStore,
} from '@tanstack/workflow-runtime'
import { createNpmStatsRefreshWorkflow } from '../src/utils/npm-stats-workflows.server'
import type {
  NpmStatsBatchResult,
  NpmStatsSyncOperations,
} from '../src/utils/npm-stats-sync.server'

test('npm stats workflow refreshes packages in resumable batches', async () => {
  const refreshedBatches: Array<Array<string>> = []
  const rebuildPackageCounts: Array<number> = []
  const operations: NpmStatsSyncOperations = {
    discoverNpmPackages: async () => ['pkg-a', 'pkg-b', 'pkg-c'],
    refreshNpmPackageBatch: async ({ packageNames }) => {
      const refreshed = [...packageNames]
      refreshedBatches.push(refreshed)

      return {
        failed: [],
        fallback: [],
        refreshed,
      }
    },
    rebuildNpmStatsCaches: async () => {
      const packageCount = refreshedBatches.flat().length
      rebuildPackageCounts.push(packageCount)

      return {
        packageCount,
        ratePerDay: packageCount * 10,
        totalDownloads: packageCount * 100,
      }
    },
  }
  const workflow = createNpmStatsRefreshWorkflow(operations)
  const runtime = defineWorkflowRuntime({
    store: inMemoryWorkflowExecutionStore(),
    workflows: {
      [workflow.id]: {
        load: async () => workflow,
        schedules: [],
      },
    },
  })
  const now = Date.now()

  const first = await runtime.startRun({
    workflowId: workflow.id,
    runId: 'npm-stats-refresh:test',
    input: {
      batchSize: 2,
      forceRefresh: false,
      org: 'tanstack',
      source: 'admin',
    },
    now,
    includeEvents: false,
  })

  assert.equal(first.kind, 'paused')
  assert.deepEqual(refreshedBatches, [['pkg-a', 'pkg-b']])
  assert.deepEqual(rebuildPackageCounts, [2])

  const sweep = await runtime.sweep({
    now: now + 1_000,
    maxTimers: 5,
    includeEvents: false,
  })
  const final = sweep.timers.at(-1)

  assert.equal(final?.kind, 'completed')
  assert.deepEqual(refreshedBatches, [['pkg-a', 'pkg-b'], ['pkg-c']])
  assert.deepEqual(rebuildPackageCounts, [2, 3])
  assert.deepEqual(final?.run?.output, {
    batches: [
      {
        failed: [],
        fallback: [],
        refreshed: ['pkg-a', 'pkg-b'],
      } satisfies NpmStatsBatchResult,
      {
        failed: [],
        fallback: [],
        refreshed: ['pkg-c'],
      } satisfies NpmStatsBatchResult,
    ],
    failed: 0,
    fallback: 0,
    packageCount: 3,
    refreshed: 3,
    totalDownloads: 300,
  })
})
