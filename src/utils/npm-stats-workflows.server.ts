import { createWorkflow } from '@tanstack/workflow-core'
import type { StepOptions } from '@tanstack/workflow-core'
import { every } from '@tanstack/workflow-runtime'
import type { WorkflowRegistrationMap } from '@tanstack/workflow-runtime'
import { z } from 'zod'
import {
  defaultNpmStatsSyncOperations,
  summarizeNpmStatsRefresh,
  type NpmStatsBatchResult,
  type NpmStatsCacheRebuildResult,
  type NpmStatsSyncOperations,
} from './npm-stats-sync.server'

export const npmStatsRefreshWorkflowId = 'npm-stats-refresh-workflow'

const npmStatsRefreshInputSchema = z.object({
  batchSize: z.number().int().positive().max(25).default(5),
  forceRefresh: z.boolean().default(false),
  org: z.string().default('tanstack'),
  source: z.enum(['schedule', 'admin']).default('schedule'),
})

const discoverStepOptions = {
  retry: { maxAttempts: 2, backoff: 'exponential', baseMs: 1_000 },
  timeout: 2 * 60 * 1000,
} satisfies StepOptions

const refreshBatchStepOptions = {
  timeout: 4 * 60 * 1000,
} satisfies StepOptions

const rebuildCachesStepOptions = {
  timeout: 60_000,
} satisfies StepOptions

export function createNpmStatsRefreshWorkflow(
  operations: NpmStatsSyncOperations = defaultNpmStatsSyncOperations,
) {
  return createWorkflow({
    id: npmStatsRefreshWorkflowId,
    input: npmStatsRefreshInputSchema,
  }).handler(async (ctx) => {
    const packageNames = await ctx.step(
      'discover-npm-packages',
      () => operations.discoverNpmPackages({ org: ctx.input.org }),
      discoverStepOptions,
    )
    const batches: Array<NpmStatsBatchResult> = []
    let latestCache: NpmStatsCacheRebuildResult | undefined

    for (
      let offset = 0;
      offset < packageNames.length;
      offset += ctx.input.batchSize
    ) {
      const packageBatch = packageNames.slice(
        offset,
        offset + ctx.input.batchSize,
      )
      const batch = await ctx.step(
        `refresh-npm-packages:${offset}`,
        () =>
          operations.refreshNpmPackageBatch({
            forceRefresh: ctx.input.forceRefresh,
            packageNames: packageBatch,
          }),
        refreshBatchStepOptions,
      )
      batches.push(batch)

      latestCache = await ctx.step(
        `rebuild-npm-caches:${offset}`,
        () => operations.rebuildNpmStatsCaches({ org: ctx.input.org }),
        rebuildCachesStepOptions,
      )

      if (offset + ctx.input.batchSize < packageNames.length) {
        await ctx.sleep(0)
      }
    }

    return summarizeNpmStatsRefresh(batches, latestCache)
  })
}

const npmStatsRefreshWorkflow = createNpmStatsRefreshWorkflow()

export const npmStatsWorkflowRegistrations = {
  [npmStatsRefreshWorkflow.id]: {
    load: async () => npmStatsRefreshWorkflow,
    schedules: [
      {
        id: 'npm-stats-refresh-every-6h',
        schedule: every.hours(6),
        overlapPolicy: 'skip',
        input: {
          batchSize: 5,
          forceRefresh: false,
          org: 'tanstack',
          source: 'schedule',
        },
      },
    ],
  },
} satisfies WorkflowRegistrationMap
