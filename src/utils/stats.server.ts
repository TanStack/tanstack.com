import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

// Re-export pure functions for use in server functions
export {
  fetchGitHubOwnerStats,
  fetchGitHubRepoStats,
  refreshNpmOrgStats,
  fetchSingleNpmPackageFresh,
  computeNpmOrgStats,
} from './stats.functions'

export interface Library {
  id: string
  repo: string
  frameworks?: string[]
}

export interface GitHubStats {
  starCount: number
  contributorCount: number
  dependentCount?: number // Scraped from GitHub web UI
  forkCount?: number
  repositoryCount?: number // Only for org-level stats
}

export interface NpmPackageStats {
  downloads: number
  ratePerDay?: number // Downloads per day (growth rate for interpolation)
  updatedAt?: number // Timestamp when these stats were fetched (ms since epoch)
}

export interface NpmStats {
  totalDownloads: number
  packages?: string
  // Per-package stats with rate information
  packageStats?: Record<string, NpmPackageStats>
  // Aggregate rate and timestamp for animating the total
  ratePerDay?: number // Aggregate downloads per day across all packages (growth rate)
  updatedAt?: number // Most recent update timestamp across all packages (ms since epoch)
}

export interface OSSStats {
  github: GitHubStats
  npm: NpmStats
}

export interface OSSStatsWithDelta extends OSSStats {
  delta?: {
    github?: {
      starCount?: number
      contributorCount?: number
      dependentCount?: number
      forkCount?: number
    }
    npm?: {
      totalDownloads?: number
    }
  }
  // Time between previous and current stats (in milliseconds)
  // Used to calculate rate of change for animation interpolation
  timeDelta?: number
}

export type StatsQueryParams = {
  library?: {
    id: string
    repo: string
    frameworks?: string[]
  }
}

/**
 * Fetch NPM package statistics for multiple packages
 * Aggregates stats from individual package cache
 * Uses batched database query for better performance
 */
export async function fetchNpmPackageStats(
  packageNames: string[]
): Promise<NpmStats> {
  // Handle empty array case
  if (packageNames.length === 0) {
    return {
      totalDownloads: 0,
      packageStats: {},
    }
  }

  // Import db functions dynamically to avoid pulling server code into client bundle
  const { getBatchCachedNpmPackageStats } = await import('./stats-db.server')

  // Batch fetch all packages in a single database query
  const results = await getBatchCachedNpmPackageStats(packageNames)

  // Fill in zeros for any missing packages
  for (const packageName of packageNames) {
    if (!results.has(packageName)) {
      results.set(packageName, { downloads: 0 })
    }
  }

  // Calculate total downloads, aggregate rate, and find most recent update
  const packageStats: Record<string, NpmPackageStats> = {}
  let totalDownloads = 0
  let totalRatePerDay = 0
  let mostRecentUpdate = 0

  for (const [packageName, stats] of results.entries()) {
    totalDownloads += stats.downloads
    packageStats[packageName] = stats

    // Sum up rates for aggregate animation
    if (stats.ratePerDay) {
      totalRatePerDay += stats.ratePerDay
    }

    // Track most recent update timestamp
    if (stats.updatedAt && stats.updatedAt > mostRecentUpdate) {
      mostRecentUpdate = stats.updatedAt
    }
  }

  return {
    totalDownloads,
    packageStats,
    ratePerDay: totalRatePerDay !== 0 ? totalRatePerDay : undefined,
    updatedAt: mostRecentUpdate > 0 ? mostRecentUpdate : undefined,
  }
}

// Database functions moved to stats-db.server.ts

/**
 * Fetch NPM organization statistics with caching
 * Checks cache first, falls back to expired cache if available
 * Never computes fresh stats - scheduled tasks handle that
 */
async function fetchNpmOrgStats(org: string): Promise<NpmStats> {
  // Import db functions dynamically to avoid pulling server code into client bundle
  const { getCachedNpmOrgStats, getExpiredNpmOrgStats } = await import(
    './stats-db.server'
  )

  // Try cache first
  const cached = await getCachedNpmOrgStats(org)
  if (cached !== null) {
    return cached
  }

  // Cache expired - try to use expired cache as fallback
  const expiredCache = await getExpiredNpmOrgStats(org)
  if (expiredCache !== null) {
    return expiredCache
  }

  // No cache available - return zero stats
  // Scheduled tasks will populate the cache
  return {
    totalDownloads: 0,
    packageStats: {},
  }
}

// GitHub cache functions moved to stats-db.server.ts

/**
 * Calculate delta between previous and current stats
 */
function calculateDelta(
  previousGitHub: GitHubStats | null,
  currentGitHub: GitHubStats,
  previousNpm: NpmStats | null,
  currentNpm: NpmStats,
  timeDeltaMs: number
): OSSStatsWithDelta {
  return {
    github: currentGitHub,
    npm: currentNpm,
    delta: {
      github: previousGitHub
        ? {
            starCount: currentGitHub.starCount - previousGitHub.starCount,
            contributorCount:
              currentGitHub.contributorCount - previousGitHub.contributorCount,
            dependentCount:
              currentGitHub.dependentCount !== undefined &&
              previousGitHub.dependentCount !== undefined
                ? currentGitHub.dependentCount - previousGitHub.dependentCount
                : undefined,
            forkCount:
              currentGitHub.forkCount !== undefined &&
              previousGitHub.forkCount !== undefined
                ? currentGitHub.forkCount - previousGitHub.forkCount
                : undefined,
          }
        : undefined,
      npm: previousNpm
        ? {
            totalDownloads:
              currentNpm.totalDownloads - previousNpm.totalDownloads,
          }
        : undefined,
    },
    timeDelta: timeDeltaMs,
  }
}

/**
 * Server function to get OSS statistics
 * GitHub stats are cached separately, NPM stats are aggregated from individual package cache
 */
export const getOSSStats = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      library: z
        .object({
          id: z.string(),
          repo: z.string(),
          frameworks: z.array(z.string()).optional(),
        })
        .optional(),
    })
  )
  .handler(async ({ data }): Promise<OSSStatsWithDelta> => {
    // Add HTTP caching headers for better performance
    // Cache for 5 minutes on CDN, allow stale content for up to 1 hour
    setResponseHeaders(
      new Headers({
        'Cache-Control':
          'public, max-age=300, stale-while-revalidate=3600, stale-if-error=3600',
        'CDN-Cache-Control': 'max-age=300, stale-while-revalidate=3600',
        'Netlify-Vary': 'query=data',
      })
    )

    let githubCacheKey: string
    let npmPackageNames: string[]

    // Import db functions dynamically to avoid pulling server code into client bundle
    const {
      getRegisteredPackages,
      getCachedGitHubStats,
      getExpiredGitHubStats,
    } = await import('./stats-db.server')

    if (data.library) {
      // Get stats for a specific library
      githubCacheKey = data.library.repo

      // Fetch registered packages for this library from the database
      npmPackageNames = await getRegisteredPackages(data.library.id)

      // If no packages are registered yet, fall back to basic package name
      // This ensures the system works before the first package discovery run
      if (npmPackageNames.length === 0) {
        npmPackageNames = [`@tanstack/${data.library.id}`]
        console.warn(
          `[OSS Stats] No registered packages found for ${data.library.id}, using fallback:`,
          npmPackageNames
        )
      }
    } else {
      // Get aggregate stats for TanStack org
      githubCacheKey = 'org:tanstack'
      // For org stats, we'll fetch all packages via fetchNpmOrgStats
      npmPackageNames = []
    }

    // Try to get GitHub stats from cache (prefer valid cache, fallback to expired)
    const cachedGitHub = await getCachedGitHubStats(githubCacheKey)
    let githubStats: GitHubStats
    let previousGitHubStats: GitHubStats | null = null
    let githubTimeDeltaMs: number = 60 * 60 * 1000 // Default 1 hour

    if (cachedGitHub) {
      githubStats = cachedGitHub.stats
      previousGitHubStats = cachedGitHub.previousStats
      githubTimeDeltaMs = cachedGitHub.timeDeltaMs
    } else {
      // Cache expired or missing - try to use expired cache as fallback
      const expiredCache = await getExpiredGitHubStats(githubCacheKey)
      if (expiredCache) {
        githubStats = expiredCache.stats
        previousGitHubStats = expiredCache.previousStats
        githubTimeDeltaMs = expiredCache.timeDeltaMs
      } else {
        // No cache available - return zero stats
        // Scheduled tasks will populate the cache
        githubStats = {
          starCount: 0,
          contributorCount: 0,
          // dependentCount not available via GitHub API
        }
        previousGitHubStats = null
        githubTimeDeltaMs = 60 * 60 * 1000
      }
    }

    // Get NPM stats (aggregated from individual package cache)
    let npmStats: NpmStats
    if (data.library) {
      npmStats = await fetchNpmPackageStats(npmPackageNames)
    } else {
      npmStats = await fetchNpmOrgStats('tanstack')
    }

    // Ensure totalDownloads is set (should never be undefined, but defensive check)
    if (npmStats.totalDownloads === undefined) {
      npmStats.totalDownloads = 0
    }

    // Calculate delta using GitHub previous stats
    // For NPM, we'd need to track previous aggregated totals, but individual packages
    // already have rate info, so we'll use that for interpolation
    return calculateDelta(
      previousGitHubStats,
      githubStats,
      null, // NPM delta calculated from individual package rates
      npmStats,
      githubTimeDeltaMs
    )
  })
