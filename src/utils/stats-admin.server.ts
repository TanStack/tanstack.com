/**
 * Admin server functions for managing GitHub and NPM stats
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '~/db/client'
import { githubStatsCache, npmPackages, npmOrgStatsCache } from '~/db/schema'
import { eq, desc, and, like } from 'drizzle-orm'
import { fetchGitHubOwnerStats, fetchGitHubRepoStats } from './stats.functions'
import { refreshNpmOrgStats } from './stats.server'
import { setCachedGitHubStats } from './stats-db.server'
import { setCachedNpmPackageStats } from './stats-db.server'
import { requireCapability } from './auth.server'

/**
 * List all GitHub stats cache entries
 */
export const listGitHubStatsCache = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })

    const entries = await db.query.githubStatsCache.findMany({
      orderBy: [desc(githubStatsCache.updatedAt)],
    })

    return entries.map((entry) => ({
      cacheKey: entry.cacheKey,
      stats: entry.stats as any,
      previousStats: entry.previousStats as any,
      expiresAt: entry.expiresAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }))
  },
)

/**
 * Refresh GitHub stats for a specific repo or org
 */
export const refreshGitHubStats = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      cacheKey: z.string(), // e.g., "tanstack/query" or "org:tanstack"
    }),
  )
  .handler(async ({ data }) => {
    await requireCapability({ data: { capability: 'admin' } })

    const isOrg = data.cacheKey.startsWith('org:')
    const identifier = isOrg ? data.cacheKey.replace('org:', '') : data.cacheKey

    let stats
    if (isOrg) {
      stats = await fetchGitHubOwnerStats(identifier)
    } else {
      stats = await fetchGitHubRepoStats(identifier)
    }

    await setCachedGitHubStats(data.cacheKey, stats, 1)

    return {
      success: true,
      cacheKey: data.cacheKey,
      stats,
    }
  })

/**
 * Refresh all GitHub stats cache entries
 * Processes all libraries from the libraries array, plus any existing org cache entries
 */
export const refreshAllGitHubStats = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })

    const results = []
    const errors = []

    // First, refresh all libraries from the libraries array
    const { libraries } = await import('~/libraries')
    console.log(
      `[GitHub Stats Refresh] Processing ${libraries.length} libraries from libraries array`,
    )

    for (let i = 0; i < libraries.length; i++) {
      const library = libraries[i]
      if (!library.repo) {
        console.log(
          `[GitHub Stats Refresh] Skipping library ${library.id} - no repo`,
        )
        continue
      }

      try {
        const stats = await fetchGitHubRepoStats(library.repo)
        await setCachedGitHubStats(library.repo, stats, 1)

        results.push({
          cacheKey: library.repo,
          success: true,
          stats,
        })

        // Add delay between requests to avoid rate limiting (except for last item)
        if (i < libraries.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        console.error(
          `[GitHub Stats Refresh] Failed to refresh ${library.repo}:`,
          errorMessage,
        )
        errors.push({
          cacheKey: library.repo,
          success: false,
          error: errorMessage,
        })
      }
    }

    // Also refresh any org-level cache entries (like "org:tanstack")
    const orgEntries = await db.query.githubStatsCache.findMany({
      where: like(githubStatsCache.cacheKey, 'org:%'),
    })

    for (let i = 0; i < orgEntries.length; i++) {
      const entry = orgEntries[i]
      try {
        const identifier = entry.cacheKey.replace('org:', '')
        const stats = await fetchGitHubOwnerStats(identifier)
        await setCachedGitHubStats(entry.cacheKey, stats, 1)

        results.push({
          cacheKey: entry.cacheKey,
          success: true,
          stats,
        })

        // Add delay between requests to avoid rate limiting (except for last item)
        if (i < orgEntries.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        console.error(
          `[GitHub Stats Refresh] Failed to refresh ${entry.cacheKey}:`,
          errorMessage,
        )
        errors.push({
          cacheKey: entry.cacheKey,
          success: false,
          error: errorMessage,
        })
      }
    }

    return {
      success: true,
      refreshed: results.length,
      failed: errors.length,
      results,
      errors,
    }
  },
)

/**
 * List all NPM packages with their stats
 */
export const listNpmPackages = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      libraryId: z.string().optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireCapability({ data: { capability: 'admin' } })

    const whereConditions = []
    if (data.libraryId) {
      whereConditions.push(eq(npmPackages.libraryId, data.libraryId))
    }
    if (data.search) {
      whereConditions.push(like(npmPackages.packageName, `%${data.search}%`))
    }

    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined

    const packages = await db.query.npmPackages.findMany({
      where: whereClause,
      orderBy: [desc(npmPackages.updatedAt)],
    })

    return {
      packages: packages.map((pkg) => ({
        id: pkg.id,
        packageName: pkg.packageName,
        githubRepo: pkg.githubRepo,
        libraryId: pkg.libraryId,
        isLegacy: pkg.isLegacy,
        downloads: pkg.downloads,
        ratePerDay: pkg.ratePerDay,
        statsExpiresAt: pkg.statsExpiresAt,
        metadataCheckedAt: pkg.metadataCheckedAt,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      })),
    }
  })

/**
 * Refresh NPM stats for a specific package
 */
export const refreshNpmPackageStats = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      packageName: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    await requireCapability({ data: { capability: 'admin' } })

    try {
      // Use wide date range to get all-time download counts
      const response = await fetch(
        `https://api.npmjs.org/downloads/point/2010-01-01:2030-12-31/${data.packageName}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'TanStack-Stats',
          },
        },
      )

      if (!response.ok) {
        if (response.status === 404) {
          await setCachedNpmPackageStats(data.packageName, 0, 1)
          return {
            success: true,
            packageName: data.packageName,
            downloads: 0,
            message: 'Package not found, cached as 0',
          }
        }
        throw new Error(`NPM API error: ${response.status}`)
      }

      const apiData = await response.json()
      const downloads = apiData.downloads ?? 0

      await setCachedNpmPackageStats(data.packageName, downloads, 24)

      return {
        success: true,
        packageName: data.packageName,
        downloads,
      }
    } catch (error) {
      return {
        success: false,
        packageName: data.packageName,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

/**
 * List NPM org stats cache entries
 */
export const listNpmOrgStatsCache = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })

    const entries = await db.query.npmOrgStatsCache.findMany({
      orderBy: [desc(npmOrgStatsCache.updatedAt)],
    })

    return Promise.all(
      entries.map(async (entry) => {
        // Calculate total ratePerDay from packages in the database
        const { like, or } = await import('drizzle-orm')
        const { libraries } = await import('~/libraries')

        const legacyPackages: string[] = []
        for (const library of libraries) {
          if (
            'legacyPackages' in library &&
            Array.isArray(library.legacyPackages)
          ) {
            legacyPackages.push(...library.legacyPackages)
          }
        }

        let packages = await db.query.npmPackages.findMany({
          where: like(npmPackages.packageName, `@${entry.orgName}/%`),
        })

        if (legacyPackages.length > 0) {
          const legacyResults = await db.query.npmPackages.findMany({
            where: or(
              ...legacyPackages.map((pkg) => eq(npmPackages.packageName, pkg)),
            ),
          })
          packages = [...packages, ...legacyResults]
        }

        const totalRatePerDay = packages.reduce(
          (sum, pkg) => sum + (pkg.ratePerDay ?? 0),
          0,
        )

        return {
          orgName: entry.orgName,
          totalDownloads: entry.totalDownloads,
          ratePerDay: totalRatePerDay > 0 ? totalRatePerDay : undefined,
          packageStats: entry.packageStats as {},
          expiresAt: entry.expiresAt,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        }
      }),
    )
  },
)

/**
 * Get library-level NPM stats (from cache only)
 */
export const getLibraryNpmStats = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })

    const { getAllCachedLibraryStats } = await import('./stats-db.server')
    const { libraries } = await import('~/libraries')

    const cachedStats = await getAllCachedLibraryStats()
    const statsMap = new Map(cachedStats.map((s) => [s.libraryId, s]))

    // Get all packages to calculate ratePerDay for each library
    const allPackages = await db.query.npmPackages.findMany()

    // Return stats for all libraries, using cached data when available
    return libraries.map((library) => {
      const cached = statsMap.get(library.id)

      // Calculate ratePerDay by summing up all packages' ratePerDay for this library
      const libraryPackages = allPackages.filter(
        (pkg) => pkg.libraryId === library.id,
      )
      const ratePerDay = libraryPackages.reduce(
        (sum, pkg) => sum + (pkg.ratePerDay ?? 0),
        0,
      )

      if (!cached) {
        return {
          libraryId: library.id,
          libraryName: library.name,
          packageCount: 0,
          totalDownloads: 0,
          previousTotalDownloads: null,
          ratePerDay: ratePerDay > 0 ? ratePerDay : null,
        }
      }

      return {
        libraryId: library.id,
        libraryName: library.name,
        packageCount: cached.packageCount,
        totalDownloads: cached.totalDownloads,
        previousTotalDownloads: cached.previousTotalDownloads,
        ratePerDay: ratePerDay > 0 ? ratePerDay : null,
      }
    })
  },
)

/**
 * Complete atomic refresh of all NPM stats
 * Wraps refreshNpmOrgStats which handles:
 * 1. Package discovery
 * 2. Fresh stats fetch with growth rates
 * 3. Library cache rebuild
 * 4. Org cache update
 */
export const refreshAllNpmStats = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      org: z.string().default('tanstack'),
    }),
  )
  .handler(async ({ data }) => {
    console.log(
      `[Admin] refreshAllNpmStats handler called with org: ${data.org}`,
    )

    await requireCapability({ data: { capability: 'admin' } })

    console.log(`[Admin] Starting complete NPM stats refresh for ${data.org}`)

    // refreshNpmOrgStats handles everything atomically (always bypasses cache)
    const stats = await refreshNpmOrgStats(data.org)

    console.log('[Admin] Complete NPM stats refresh finished')

    return {
      success: true,
      org: data.org,
      stats,
    }
  })
