import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createWorkflow, LogConflictError } from '@tanstack/workflow-core'
import {
  defineWorkflowRuntime,
  inMemoryWorkflowExecutionStore,
  materializeWorkflowSchedules,
} from '@tanstack/workflow-runtime'
import { createDrizzlePostgresWorkflowStore } from '@tanstack/workflow-store-drizzle-postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { z } from 'zod'
import * as schema from '../src/db/schema'
import { createAppWorkflowRuntime } from '../src/utils/workflow-runtime.server'
import {
  createIntentWorkflowRegistrations,
  INTENT_PROCESS_SCHEDULE_ID,
  INTENT_PROCESS_WORKFLOW_ID,
} from '../src/utils/intent-workflows.server'
import type {
  IntentProcessResult,
  IntentSyncOperations,
  IntentVersionProcessResult,
} from '../src/utils/intent-sync.server'

test(
  'Postgres/Drizzle workflow store appends events and replays by run ID',
  {
    skip:
      process.env.INTENT_WORKFLOW_DB_TESTS === '1'
        ? false
        : 'Set INTENT_WORKFLOW_DB_TESTS=1 with DATABASE_URL to run DB adapter coverage',
  },
  async () => {
    const databaseUrl = process.env.DATABASE_URL
    assert.ok(databaseUrl, 'DATABASE_URL is required for this test')

    const client = postgres(databaseUrl, { max: 1, connect_timeout: 5 })
    const database = drizzle(client, { schema })
    const schemaName = `workflow_test_${process.pid}_${Date.now()}`

    try {
      await database.execute(sql.raw(`create schema ${quoteIdent(schemaName)}`))

      let stepCalls = 0
      const workflow = createWorkflow({
        id: 'test-replay-workflow',
        input: z.object({ value: z.number() }),
      }).handler(async (ctx) => {
        const doubled = await ctx.step('double-value', () => {
          stepCalls++
          return ctx.input.value * 2
        })
        return { doubled }
      })

      const store = createDrizzlePostgresWorkflowStore({
        db: database,
        schema: schemaName,
      })
      await store.ensureSchema()

      const runtime = defineWorkflowRuntime({
        store,
        workflows: {
          'test-replay-workflow': {
            load: async () => workflow,
          },
        },
      })

      await runtime.startRun({
        workflowId: 'test-replay-workflow',
        runId: 'test-replay:1',
        input: { value: 21 },
        now: Date.UTC(2026, 4, 26, 12, 0, 0),
        includeEvents: false,
      })
      await runtime.startRun({
        workflowId: 'test-replay-workflow',
        runId: 'test-replay:1',
        input: { value: 21 },
        now: Date.UTC(2026, 4, 26, 12, 0, 1),
        includeEvents: false,
      })

      assert.equal(stepCalls, 1)
      const timeline = await store.getRunTimeline('test-replay:1')
      assert.ok(timeline)
      assert.equal(
        timeline.events.filter((event) => event.eventType === 'STEP_FINISHED')
          .length,
        1,
      )
      const firstEvent = timeline.events[0]?.event
      assert.ok(firstEvent)
      await assert.rejects(
        () =>
          store.appendEvents({
            runId: 'test-replay:1',
            expectedNextIndex: 0,
            events: [firstEvent],
          }),
        LogConflictError,
      )
    } finally {
      await database.execute(
        sql.raw(`drop schema if exists ${quoteIdent(schemaName)} cascade`),
      )
      await client.end()
    }
  },
)

test('duplicate scheduled invocation with the same bucket is idempotent', async () => {
  let selectCalls = 0
  let processCalls = 0
  const store = inMemoryWorkflowExecutionStore()
  const runtime = createAppWorkflowRuntime({
    store,
    workflowRegistrations: createIntentWorkflowRegistrations({
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
    }),
  })
  const now = Date.UTC(2026, 4, 26, 12, 0, 0)

  await materializeWorkflowSchedules(runtime, { now })
  const first = await runtime.sweep({ now, includeEvents: false })
  await materializeWorkflowSchedules(runtime, { now })
  const second = await runtime.sweep({ now, includeEvents: false })

  const processRun = first.scheduled.find(
    (run) => run.workflowId === INTENT_PROCESS_WORKFLOW_ID,
  )
  assert.ok(processRun)
  assert.equal(
    processRun.runId,
    `${INTENT_PROCESS_WORKFLOW_ID}:${INTENT_PROCESS_SCHEDULE_ID}:${now}`,
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
  const runtime = createAppWorkflowRuntime({
    store: inMemoryWorkflowExecutionStore(),
    workflowRegistrations: createIntentWorkflowRegistrations({
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
    }),
  })

  const result = await runtime.startRun({
    workflowId: INTENT_PROCESS_WORKFLOW_ID,
    runId: 'intent-process:test-partial-failure',
    input: { batchSize: 3, source: 'admin' },
    now: Date.UTC(2026, 4, 26, 12, 15, 0),
    includeEvents: false,
  })

  assert.equal(result.kind, 'completed')
  assert.ok(result.run)
  assert.deepEqual(result.run.output, expected)
})

test('process workflow continues from queue state across scheduled invocations', async () => {
  const queue = [
    { id: 1, packageName: '@example/one', version: '1.0.0' },
    { id: 2, packageName: '@example/two', version: '1.0.0' },
  ]
  const processed: Array<string> = []
  const store = inMemoryWorkflowExecutionStore()
  const operations: IntentSyncOperations = {
    ...noopOperations,
    selectPendingIntentVersions: async () => {
      const next = queue.shift()
      return next ? [next] : []
    },
    processIntentVersion: async (versionId: number) => {
      const packageName = versionId === 1 ? '@example/one' : '@example/two'
      const version = '1.0.0'
      processed.push(`${packageName}@${version}`)
      return {
        packageName,
        version,
        status: 'synced',
        skillCount: 1,
      }
    },
  }
  const firstRuntime = createAppWorkflowRuntime({
    store,
    workflowRegistrations: createIntentWorkflowRegistrations({ operations }),
  })
  const secondRuntime = createAppWorkflowRuntime({
    store,
    workflowRegistrations: createIntentWorkflowRegistrations({ operations }),
  })
  const firstBucket = Date.UTC(2026, 4, 26, 12, 0, 0)
  const secondBucket = Date.UTC(2026, 4, 26, 12, 15, 0)

  await materializeWorkflowSchedules(firstRuntime, { now: firstBucket })
  await firstRuntime.sweep({ now: firstBucket, includeEvents: false })
  await materializeWorkflowSchedules(secondRuntime, { now: secondBucket })
  await secondRuntime.sweep({ now: secondBucket, includeEvents: false })

  const runs = await store.listRuns({
    workflowId: INTENT_PROCESS_WORKFLOW_ID,
    limit: 10,
  })

  assert.deepEqual(processed, ['@example/one@1.0.0', '@example/two@1.0.0'])
  assert.equal(runs.length, 2)
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

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}
