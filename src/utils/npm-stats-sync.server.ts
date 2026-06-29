import type { NpmStats } from './stats.types'
import {
  getNpmOrgPackageNames,
  refreshNpmPackageStatsBatch,
  type FetchNpmPackageDownloadsOptions,
} from './stats.functions'

export interface NpmStatsBatchResult {
  failed: Array<{ error: string; packageName: string }>
  fallback: Array<string>
  refreshed: Array<string>
}

export interface NpmStatsCacheRebuildResult {
  packageCount: number
  ratePerDay?: number
  totalDownloads: number
}

export interface NpmStatsRefreshSummary {
  batches: Array<NpmStatsBatchResult>
  failed: number
  fallback: number
  packageCount: number
  refreshed: number
  totalDownloads?: number
}

export interface NpmStatsSyncOperations {
  discoverNpmPackages: (options: { org: string }) => Promise<Array<string>>
  rebuildNpmStatsCaches: (options: {
    org: string
  }) => Promise<NpmStatsCacheRebuildResult>
  refreshNpmPackageBatch: (
    options: {
      packageNames: Array<string>
    } & FetchNpmPackageDownloadsOptions,
  ) => Promise<NpmStatsBatchResult>
}

export const defaultNpmStatsSyncOperations: NpmStatsSyncOperations = {
  discoverNpmPackages,
  rebuildNpmStatsCaches,
  refreshNpmPackageBatch,
}

export async function discoverNpmPackages({
  org,
}: {
  org: string
}): Promise<Array<string>> {
  const { discoverAndRegisterPackages } = await import('./stats-db.server')

  await discoverAndRegisterPackages(org)
  return getNpmOrgPackageNames(org)
}

export async function refreshNpmPackageBatch({
  forceRefresh,
  packageNames,
}: {
  packageNames: Array<string>
} & FetchNpmPackageDownloadsOptions): Promise<NpmStatsBatchResult> {
  return refreshNpmPackageStatsBatch(packageNames, { forceRefresh })
}

export async function rebuildNpmStatsCaches({
  org,
}: {
  org: string
}): Promise<NpmStatsCacheRebuildResult> {
  const {
    computeOrgStatsFromCache,
    rebuildLibraryCaches,
    rebuildOssStatsCache,
    setCachedNpmOrgStats,
  } = await import('./stats-db.server')

  const stats: NpmStats = await computeOrgStatsFromCache(org)
  await setCachedNpmOrgStats(org, stats)
  await rebuildLibraryCaches()
  await rebuildOssStatsCache(org)

  return {
    packageCount: Object.keys(stats.packageStats ?? {}).length,
    ratePerDay: stats.ratePerDay,
    totalDownloads: stats.totalDownloads,
  }
}

export function summarizeNpmStatsRefresh(
  batches: Array<NpmStatsBatchResult>,
  latestCache?: NpmStatsCacheRebuildResult,
): NpmStatsRefreshSummary {
  return {
    batches,
    failed: batches.reduce((sum, batch) => sum + batch.failed.length, 0),
    fallback: batches.reduce((sum, batch) => sum + batch.fallback.length, 0),
    packageCount: latestCache?.packageCount ?? 0,
    refreshed: batches.reduce((sum, batch) => sum + batch.refreshed.length, 0),
    totalDownloads: latestCache?.totalDownloads,
  }
}
