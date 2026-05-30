import { createWorkflow } from '@tanstack/workflow-core'
import type { StepOptions } from '@tanstack/workflow-core'
import { every } from '@tanstack/workflow-runtime'
import type { WorkflowRegistrationMap } from '@tanstack/workflow-runtime'
import { z } from 'zod'
import {
  defaultIntentSyncOperations,
  summarizeIntentProcessResults,
} from '~/utils/intent-sync.server'
import type {
  IntentSyncOperations,
  IntentVersionProcessResult,
} from '~/utils/intent-sync.server'

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

function createIntentDiscoverWorkflow(
  operations: IntentSyncOperations = defaultIntentSyncOperations,
) {
  return createWorkflow({
    id: 'intent-discover-workflow',
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
    id: 'intent-process-workflow',
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

const intentDiscoverWorkflow = createIntentDiscoverWorkflow()
const intentProcessWorkflow = createIntentProcessWorkflow()

export const intentWorkflowRegistrations = {
  [intentDiscoverWorkflow.id]: {
    load: async () => intentDiscoverWorkflow,
    schedules: [
      {
        id: 'intent-discover-every-6h',
        schedule: every.hours(6),
        overlapPolicy: 'skip',
        input: { source: 'schedule' },
      },
    ],
  },
  [intentProcessWorkflow.id]: {
    load: async () => intentProcessWorkflow,
    schedules: [
      {
        id: 'intent-process-every-15m',
        schedule: every.minutes(15),
        overlapPolicy: 'skip',
        input: {
          batchSize: 50,
          source: 'schedule',
        },
      },
    ],
  },
} satisfies WorkflowRegistrationMap

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
