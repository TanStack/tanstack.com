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

const PROCESS_WORKFLOW_SELECT_LIMIT = 50

const intentProcessInputSchema = z.object({
  source: z.enum(['schedule', 'admin']).default('schedule'),
})

const discoverStepOptions = {
  retry: { maxAttempts: 2, backoff: 'exponential', baseMs: 1_000 },
  timeout: 20_000,
} satisfies StepOptions

const NPM_SEARCH_PAGE_SIZE = 250
const MAX_NPM_SEARCH_RESULTS = 1_000

const selectPendingVersionsStepOptions = {
  timeout: 30_000,
} satisfies StepOptions

const processVersionStepOptions = {
  timeout: 2 * 60 * 1000,
} satisfies StepOptions

export const INTENT_DISCOVER_WORKFLOW_ID = 'intent-discover-workflow'
export const INTENT_PROCESS_WORKFLOW_ID = 'intent-process-workflow'
export const INTENT_DISCOVER_SCHEDULE_ID = 'intent-discover-every-6h'
export const INTENT_PROCESS_SCHEDULE_ID = 'intent-process-every-15m'

export function createIntentDiscoverWorkflow(
  operations: IntentSyncOperations = defaultIntentSyncOperations,
) {
  return createWorkflow({
    id: INTENT_DISCOVER_WORKFLOW_ID,
    input: intentDiscoverInputSchema,
  }).handler(async (ctx) => {
    const errors: Array<string> = []
    const discoveredPackageNames: Array<string> = []
    let packagesVerified = 0
    let versionsEnqueued = 0
    let searchOffset = 0

    while (discoveredPackageNames.length < MAX_NPM_SEARCH_RESULTS) {
      try {
        const page = await ctx.step(
          `search-npm-packages:${searchOffset}`,
          () =>
            operations.searchIntentNpmPackagesPage({
              from: searchOffset,
              size: NPM_SEARCH_PAGE_SIZE,
            }),
          discoverStepOptions,
        )
        discoveredPackageNames.push(...page.packageNames)
        searchOffset += NPM_SEARCH_PAGE_SIZE

        if (searchOffset >= page.total || page.packageNames.length === 0) break
      } catch (error) {
        errors.push(`npm-search: ${getErrorMessage(error)}`)
        break
      }
    }

    const packageNames = [...new Set(discoveredPackageNames)].slice(
      0,
      MAX_NPM_SEARCH_RESULTS,
    )
    for (const packageName of packageNames) {
      try {
        const enqueued = await ctx.step(
          `discover-npm-package:${packageName}`,
          () => operations.discoverIntentNpmPackage(packageName),
          discoverStepOptions,
        )
        if (enqueued !== null) {
          packagesVerified++
          versionsEnqueued += enqueued
        }
      } catch (error) {
        errors.push(`npm/${packageName}: ${getErrorMessage(error)}`)
      }
    }

    let githubCandidates = 0
    try {
      const candidates = await ctx.step(
        'search-github-packages',
        () => operations.searchIntentGitHubCandidates(),
        discoverStepOptions,
      )
      githubCandidates = candidates.length

      for (const candidate of candidates) {
        try {
          const enqueued = await ctx.step(
            `discover-github-package:${candidate.repo}:${candidate.path}`,
            () => operations.discoverIntentGitHubPackage(candidate),
            discoverStepOptions,
          )
          if (enqueued !== null) {
            packagesVerified++
            versionsEnqueued += enqueued
          }
        } catch (error) {
          errors.push(
            `github/${candidate.repo}/${candidate.path}: ${getErrorMessage(error)}`,
          )
        }
      }
    } catch (error) {
      errors.push(`github-search: ${getErrorMessage(error)}`)
    }

    return {
      packagesDiscovered: packageNames.length,
      githubCandidates,
      packagesVerified,
      versionsEnqueued,
      errors,
    }
  })
}

export function createIntentProcessWorkflow(
  operations: IntentSyncOperations = defaultIntentSyncOperations,
) {
  return createWorkflow({
    id: INTENT_PROCESS_WORKFLOW_ID,
    input: intentProcessInputSchema,
  }).handler(async (ctx) => {
    const attemptedIds = new Set<number>()
    const results: Array<IntentVersionProcessResult> = []
    let selectIteration = 0

    while (true) {
      const versions = await ctx.step(
        `select-pending-versions:${selectIteration}`,
        () =>
          operations.selectPendingIntentVersions({
            limit: PROCESS_WORKFLOW_SELECT_LIMIT,
            excludeIds: [...attemptedIds],
          }),
        selectPendingVersionsStepOptions,
      )
      selectIteration++

      if (versions.length === 0) break

      const unattemptedVersions = versions.filter(
        (version) => !attemptedIds.has(version.id),
      )
      if (unattemptedVersions.length === 0) break

      for (const version of unattemptedVersions) {
        attemptedIds.add(version.id)

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

      if (versions.length < PROCESS_WORKFLOW_SELECT_LIMIT) break
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
        id: INTENT_DISCOVER_SCHEDULE_ID,
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
        id: INTENT_PROCESS_SCHEDULE_ID,
        schedule: every.minutes(15),
        overlapPolicy: 'skip',
        input: {
          source: 'schedule',
        },
      },
    ],
  },
} satisfies WorkflowRegistrationMap

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
