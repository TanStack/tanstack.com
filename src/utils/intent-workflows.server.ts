import { createWorkflow } from '@tanstack/workflow-core'
import type { StepOptions } from '@tanstack/workflow-core'
import { every } from '@tanstack/workflow-runtime'
import type { WorkflowRegistrationMap } from '@tanstack/workflow-runtime'
import { z } from 'zod'
import {
  defaultIntentSyncOperations,
  INTENT_PROCESS_BATCH_SIZE,
  summarizeIntentProcessResults,
} from '~/utils/intent-sync.server'
import type {
  IntentSyncOperations,
  IntentVersionProcessResult,
} from '~/utils/intent-sync.server'

export const INTENT_DISCOVER_WORKFLOW_ID = 'intent-discover-workflow'
export const INTENT_PROCESS_WORKFLOW_ID = 'intent-process-workflow'
export const INTENT_DISCOVER_SCHEDULE_ID = 'intent-discover-every-6h'
export const INTENT_PROCESS_SCHEDULE_ID = 'intent-process-every-15m'

const intentDiscoverInputSchema = z.object({
  source: z.enum(['schedule', 'admin']).default('schedule'),
})

const intentProcessInputSchema = z.object({
  batchSize: z.number().int().positive().max(100),
  source: z.enum(['schedule', 'admin']).default('schedule'),
})

const discoverStepOptions = {
  retry: { maxAttempts: 2, backoff: 'exponential', baseMs: 1_000 },
  timeout: 10 * 60 * 1000,
} satisfies StepOptions

const selectPendingVersionsStepOptions = {
  timeout: 30_000,
} satisfies StepOptions

const processVersionStepOptions = {
  timeout: 2 * 60 * 1000,
} satisfies StepOptions

export function createIntentDiscoverWorkflow(
  operations: IntentSyncOperations = defaultIntentSyncOperations,
) {
  return createWorkflow({
    id: INTENT_DISCOVER_WORKFLOW_ID,
    input: intentDiscoverInputSchema,
  }).handler((ctx) =>
    ctx.step(
      'discover-intent-packages',
      () => operations.discoverIntentPackages(),
      discoverStepOptions,
    ),
  )
}

export function createIntentProcessWorkflow(
  operations: IntentSyncOperations = defaultIntentSyncOperations,
) {
  return createWorkflow({
    id: INTENT_PROCESS_WORKFLOW_ID,
    input: intentProcessInputSchema,
  }).handler(async (ctx) => {
    const versions = await ctx.step(
      'select-pending-versions',
      () =>
        operations.selectPendingIntentVersions({
          limit: ctx.input.batchSize,
        }),
      selectPendingVersionsStepOptions,
    )
    const results: Array<IntentVersionProcessResult> = []

    for (const version of versions) {
      try {
        results.push(
          await ctx.step(
            `process-version:${version.id}`,
            () => operations.processIntentVersion(version.id),
            processVersionStepOptions,
          ),
        )
      } catch (error) {
        results.push({
          packageName: version.packageName,
          version: version.version,
          status: 'failed',
          error: getErrorMessage(error),
        })
      }
    }

    return summarizeIntentProcessResults(results)
  })
}

export const intentDiscoverWorkflow = createIntentDiscoverWorkflow()
export const intentProcessWorkflow = createIntentProcessWorkflow()

export function createIntentWorkflowRegistrations(options?: {
  operations?: IntentSyncOperations
}) {
  const discoverWorkflow = createIntentDiscoverWorkflow(options?.operations)
  const processWorkflow = createIntentProcessWorkflow(options?.operations)

  return {
    [INTENT_DISCOVER_WORKFLOW_ID]: {
      load: async () => discoverWorkflow,
      schedules: [
        {
          id: INTENT_DISCOVER_SCHEDULE_ID,
          schedule: every.hours(6),
          overlapPolicy: 'skip',
          input: { source: 'schedule' },
        },
      ],
    },
    [INTENT_PROCESS_WORKFLOW_ID]: {
      load: async () => processWorkflow,
      schedules: [
        {
          id: INTENT_PROCESS_SCHEDULE_ID,
          schedule: every.minutes(15),
          overlapPolicy: 'skip',
          input: {
            batchSize: INTENT_PROCESS_BATCH_SIZE,
            source: 'schedule',
          },
        },
      ],
    },
  } satisfies WorkflowRegistrationMap
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
