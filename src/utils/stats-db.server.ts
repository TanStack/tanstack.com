/**
 * Database operations for stats caching
 * This file contains server-only code that uses the database.
 * It should only be imported inside server function handlers.
 */

import { db } from '~/db/client'
import {
  githubStatsCache,
  npmPackages,
  npmOrgStatsCache,
  npmLibraryStatsCache,
  npmDownloadChunks,
} from '~/db/schema'
import { eq, inArray, and } from 'drizzle-orm'
import type { GitHubStats, NpmPackageStats, NpmStats } from './stats.server'

/**
 * Batch fetch cached NPM package stats for multiple packages
 * Much more efficient than calling getCachedNpmPackageStats individually
 * Returns a map of packageName -> NpmPackageStats
 */
export async function getBatchCachedNpmPackageStats(
  packageNames: string[],
): Promise<Map<string, NpmPackageStats>> {
  const results = new Map<string, NpmPackageStats>()

  if (packageNames.length === 0) {
    return results
  }

  try {
    // Single query to fetch all packages at once
    const cached = await db.query.npmPackages.findMany({
      where: inArray(npmPackages.packageName, packageNames),
    })

    // Process all cached results
    for (const pkg of cached) {
      if (pkg.downloads !== null) {
        results.set(pkg.packageName, {
          downloads: pkg.downloads,
          ratePerDay: pkg.ratePerDay ?? undefined,
          updatedAt: pkg.updatedAt.getTime(),
        })
      }
    }

    return results
  } catch (error) {
    console.error('[NPM Stats Cache] Error reading batch cache:', error)
    return results
  }
}

/**
 * Get cached NPM package stats if available and not expired
 * Returns stats with rate information for interpolation
 */
export async function getCachedNpmPackageStats(
  packageName: string,
  ttlHours: number = 24,
): Promise<NpmPackageStats | null> {
  try {
    const cached = await db.query.npmPackages.findFirst({
      where: eq(npmPackages.packageName, packageName),
    })

    if (
      cached &&
      cached.statsExpiresAt &&
      cached.statsExpiresAt > new Date() &&
      cached.downloads !== null
    ) {
      return {
        downloads: cached.downloads,
        ratePerDay: cached.ratePerDay ?? undefined,
        updatedAt: cached.updatedAt.getTime(),
      }
    }

    // Cache expired - return expired cache if available (scheduled tasks will refresh)
    if (cached && cached.downloads !== null) {
      return {
        downloads: cached.downloads,
        ratePerDay: cached.ratePerDay ?? undefined,
        updatedAt: cached.updatedAt.getTime(),
      }
    }

    return null
  } catch (error) {
    console.error('[NPM Stats Cache] Error reading cache:', error)
    return null
  }
}

/**
 * Store NPM package stats in cache with calculated growth rate
 * Also incrementally updates library and org-level caches
 */
export async function setCachedNpmPackageStats(
  packageName: string,
  downloads: number,
  ttlHours: number = 24,
  ratePerDay?: number,
): Promise<void> {
  try {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + ttlHours)
    const now = new Date()

    const existing = await db.query.npmPackages.findFirst({
      where: eq(npmPackages.packageName, packageName),
    })

    const oldDownloads = existing?.downloads ?? 0
    const downloadDelta = downloads - oldDownloads
    // Get libraryId from existing record, or we'll need to look it up after update
    let libraryId = existing?.libraryId

    if (existing) {
      // Update stats with new data
      await db
        .update(npmPackages)
        .set({
          downloads, // New download count
          ratePerDay: ratePerDay ?? null, // Store calculated growth rate
          statsExpiresAt: expiresAt,
          updatedAt: now,
        })
        .where(eq(npmPackages.packageName, packageName))
    } else {
      try {
        // First time inserting package
        await db.insert(npmPackages).values({
          packageName,
          downloads,
          ratePerDay: ratePerDay ?? null,
          statsExpiresAt: expiresAt,
        })
      } catch (insertError: any) {
        // Handle race condition: if another request inserted the same package concurrently,
        // try updating instead
        if (insertError?.code === '23505') {
          // Unique constraint violation - fetch existing and update properly
          const raceExisting = await db.query.npmPackages.findFirst({
            where: eq(npmPackages.packageName, packageName),
          })
          if (raceExisting) {
            await db
              .update(npmPackages)
              .set({
                downloads,
                ratePerDay: ratePerDay ?? null,
                statsExpiresAt: expiresAt,
                updatedAt: now,
              })
              .where(eq(npmPackages.packageName, packageName))
          }
        } else {
          throw insertError
        }
      }
    }

    // Get libraryId after update (in case it was set during package discovery)
    const updated = await db.query.npmPackages.findFirst({
      where: eq(npmPackages.packageName, packageName),
    })
    const finalLibraryId = updated?.libraryId ?? libraryId

    // Incrementally update library cache if libraryId exists
    if (finalLibraryId && downloadDelta !== 0) {
      await updateLibraryStatsCache(finalLibraryId, downloadDelta)
    }

    // Incrementally update org cache (always update for @tanstack packages)
    if (packageName.startsWith('@tanstack/') && downloadDelta !== 0) {
      await updateOrgStatsCache(
        'tanstack',
        packageName,
        oldDownloads,
        downloads,
      )
    }
  } catch (error) {
    console.error('[NPM Stats Cache] Error writing cache:', error)
    // Don't throw - cache failures shouldn't break the request
  }
}

/**
 * Incrementally update library stats cache
 */
async function updateLibraryStatsCache(
  libraryId: string,
  downloadDelta: number,
): Promise<void> {
  try {
    const existing = await db.query.npmLibraryStatsCache.findFirst({
      where: eq(npmLibraryStatsCache.libraryId, libraryId),
    })

    if (existing) {
      await db
        .update(npmLibraryStatsCache)
        .set({
          previousTotalDownloads: existing.totalDownloads,
          totalDownloads: existing.totalDownloads + downloadDelta,
          updatedAt: new Date(),
        })
        .where(eq(npmLibraryStatsCache.libraryId, libraryId))
    } else {
      // Get package count for this library
      const packages = await db.query.npmPackages.findMany({
        where: eq(npmPackages.libraryId, libraryId),
      })
      const totalDownloads = packages.reduce(
        (sum, pkg) => sum + (pkg.downloads ?? 0),
        0,
      )

      await db.insert(npmLibraryStatsCache).values({
        libraryId,
        totalDownloads,
        packageCount: packages.length,
        previousTotalDownloads: null,
      })
    }
  } catch (error) {
    console.error(
      `[Library Stats Cache] Error updating cache for ${libraryId}:`,
      error,
    )
  }
}

/**
 * Incrementally update org stats cache
 */
async function updateOrgStatsCache(
  orgName: string,
  packageName: string,
  oldDownloads: number,
  newDownloads: number,
): Promise<void> {
  try {
    const existing = await db.query.npmOrgStatsCache.findFirst({
      where: eq(npmOrgStatsCache.orgName, orgName),
    })

    if (existing) {
      const packageStats = (existing.packageStats as Record<string, any>) || {}
      const downloadDelta = newDownloads - oldDownloads

      // Update package stats
      packageStats[packageName] = {
        downloads: newDownloads,
        previousDownloads: oldDownloads,
      }

      await db
        .update(npmOrgStatsCache)
        .set({
          totalDownloads: existing.totalDownloads + downloadDelta,
          packageStats,
          updatedAt: new Date(),
        })
        .where(eq(npmOrgStatsCache.orgName, orgName))
    } else {
      // If org cache doesn't exist, we'll need to compute it from all packages
      // This should be rare - scheduled tasks should create it
      console.warn(
        `[Org Stats Cache] Cache doesn't exist for ${orgName}, skipping incremental update`,
      )
    }
  } catch (error) {
    console.error(
      `[Org Stats Cache] Error updating cache for ${orgName}:`,
      error,
    )
  }
}

/**
 * Get cached NPM org stats if available and not expired
 */
export async function getCachedNpmOrgStats(
  orgName: string,
  ttlHours: number = 24,
): Promise<NpmStats | null> {
  try {
    const cached = await db.query.npmOrgStatsCache.findFirst({
      where: eq(npmOrgStatsCache.orgName, orgName),
    })

    if (cached && cached.expiresAt > new Date()) {
      console.log(`[NPM Org Stats Cache] Cache hit for org ${orgName}`)

      // Calculate org-level ratePerDay from packages in the database
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
        where: like(npmPackages.packageName, `@${orgName}/%`),
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
        totalDownloads: cached.totalDownloads,
        packageStats: cached.packageStats as Record<string, NpmPackageStats>,
        ratePerDay: totalRatePerDay > 0 ? totalRatePerDay : undefined,
        updatedAt: cached.updatedAt.getTime(),
      }
    }

    return null
  } catch (error) {
    console.error('[NPM Org Stats Cache] Error reading cache:', error)
    return null
  }
}

/**
 * Get expired NPM org stats cache if available (for fallback when cache is expired)
 */
export async function getExpiredNpmOrgStats(
  orgName: string,
): Promise<NpmStats | null> {
  try {
    const cached = await db.query.npmOrgStatsCache.findFirst({
      where: eq(npmOrgStatsCache.orgName, orgName),
    })

    if (cached) {
      console.log(
        `[NPM Org Stats Cache] Using expired cache for org ${orgName}`,
      )

      // Calculate org-level ratePerDay from packages in the database
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
        where: like(npmPackages.packageName, `@${orgName}/%`),
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
        totalDownloads: cached.totalDownloads,
        packageStats: cached.packageStats as Record<string, NpmPackageStats>,
        ratePerDay: totalRatePerDay > 0 ? totalRatePerDay : undefined,
        updatedAt: cached.updatedAt.getTime(),
      }
    }

    return null
  } catch (error) {
    console.error('[NPM Org Stats Cache] Error reading expired cache:', error)
    return null
  }
}

/**
 * Store NPM org stats in cache, preserving previous stats for rate calculation
 */
export async function setCachedNpmOrgStats(
  orgName: string,
  stats: NpmStats,
  ttlHours: number = 24,
): Promise<void> {
  try {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + ttlHours)
    const now = new Date()

    const existing = await db.query.npmOrgStatsCache.findFirst({
      where: eq(npmOrgStatsCache.orgName, orgName),
    })

    if (existing) {
      // Update stats
      await db
        .update(npmOrgStatsCache)
        .set({
          totalDownloads: stats.totalDownloads,
          packageStats: stats.packageStats,
          expiresAt,
          updatedAt: now,
        })
        .where(eq(npmOrgStatsCache.orgName, orgName))
      console.log(
        `[NPM Org Stats Cache] Updated cache for org ${orgName} (expires at ${expiresAt.toISOString()})`,
      )
    } else {
      // First time
      await db.insert(npmOrgStatsCache).values({
        orgName,
        totalDownloads: stats.totalDownloads,
        packageStats: stats.packageStats,
        expiresAt,
      })
      console.log(
        `[NPM Org Stats Cache] Created cache for org ${orgName} (expires at ${expiresAt.toISOString()})`,
      )
    }
  } catch (error) {
    console.error('[NPM Org Stats Cache] Error writing cache:', error)
    // Don't throw - cache failures shouldn't break the request
  }
}

/**
 * Get cached library stats
 */
export async function getCachedLibraryStats(libraryId: string): Promise<{
  libraryId: string
  totalDownloads: number
  packageCount: number
  previousTotalDownloads: number | null
} | null> {
  try {
    const cached = await db.query.npmLibraryStatsCache.findFirst({
      where: eq(npmLibraryStatsCache.libraryId, libraryId),
    })

    if (cached) {
      return {
        libraryId: cached.libraryId,
        totalDownloads: cached.totalDownloads,
        packageCount: cached.packageCount,
        previousTotalDownloads: cached.previousTotalDownloads,
      }
    }

    return null
  } catch (error) {
    console.error(
      `[Library Stats Cache] Error reading cache for ${libraryId}:`,
      error,
    )
    return null
  }
}

/**
 * Get all cached library stats
 */
export async function getAllCachedLibraryStats(): Promise<
  Array<{
    libraryId: string
    totalDownloads: number
    packageCount: number
    previousTotalDownloads: number | null
  }>
> {
  try {
    const allCached = await db.query.npmLibraryStatsCache.findMany({
      orderBy: [npmLibraryStatsCache.libraryId],
    })

    return allCached.map((cached) => ({
      libraryId: cached.libraryId,
      totalDownloads: cached.totalDownloads,
      packageCount: cached.packageCount,
      previousTotalDownloads: cached.previousTotalDownloads,
    }))
  } catch (error) {
    console.error('[Library Stats Cache] Error reading all cache:', error)
    return []
  }
}

/**
 * Get all registered packages for a specific library or all packages
 */
export async function getRegisteredPackages(
  libraryId?: string,
): Promise<string[]> {
  try {
    const packages = libraryId
      ? await db.query.npmPackages.findMany({
          where: eq(npmPackages.libraryId, libraryId),
        })
      : await db.query.npmPackages.findMany()

    return packages.map((p) => p.packageName)
  } catch (error) {
    console.error(
      '[Package Registry] Error fetching packages:',
      error instanceof Error ? error.message : String(error),
    )
    return []
  }
}

/**
 * Discover and register all packages for an org
 * This fetches all packages from npm registry and registers them in the database
 */
export async function discoverAndRegisterPackages(org: string): Promise<void> {
  try {
    // Fetch all packages in the org
    const response = await fetch(
      `https://registry.npmjs.org/-/org/${org}/package`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TanStack-Stats',
        },
      },
    )

    if (!response.ok) {
      throw new Error(
        `NPM Registry API error: ${response.status} ${response.statusText}`,
      )
    }

    const data = await response.json()
    let packageNames = Object.keys(data)

    // Import libraries to map packages to library IDs
    const { libraries } = await import('~/libraries')

    // Add legacy (non-scoped) packages from library definitions
    // The org endpoint only returns @tanstack/* scoped packages
    const legacyPackages: string[] = []
    for (const library of libraries) {
      if (
        'legacyPackages' in library &&
        Array.isArray(library.legacyPackages)
      ) {
        legacyPackages.push(...library.legacyPackages)
      }
    }

    if (legacyPackages.length > 0) {
      packageNames = [...packageNames, ...legacyPackages]
    }

    // For each package, check if it exists and register/update metadata
    for (const packageName of packageNames) {
      try {
        // Check if package already exists
        const existing = await db.query.npmPackages.findFirst({
          where: eq(npmPackages.packageName, packageName),
        })

        // Try to determine libraryId from package name
        let libraryId: string | null = null
        let isLegacy = false

        // Check for legacy packages first (exact match)
        for (const library of libraries) {
          if (
            'legacyPackages' in library &&
            Array.isArray(library.legacyPackages) &&
            library.legacyPackages.includes(packageName)
          ) {
            libraryId = library.id
            isLegacy = true
            break
          }
        }

        // If not a legacy package, try to map based on package name patterns
        if (!libraryId) {
          for (const library of libraries) {
            const libraryName = library.id

            // Special handling for "react-charts" library id
            if (libraryName === 'react-charts') {
              if (
                packageName === `@${org}/react-charts` ||
                packageName.includes('/react-charts')
              ) {
                libraryId = libraryName
                break
              }
            }

            // Special handling for "create-tsrouter-app" library id
            if (libraryName === 'create-tsrouter-app') {
              if (
                packageName === `@${org}/create-router` ||
                packageName === `@${org}/create-start` ||
                packageName.includes('/create-router') ||
                packageName.includes('/create-start')
              ) {
                libraryId = libraryName
                break
              }
            }

            // Check various patterns:
            // 1. Exact match: @tanstack/query
            // 2. Prefixed: @tanstack/react-query, @tanstack/vue-query
            // 3. Suffixed: @tanstack/query-core, @tanstack/query-devtools
            if (
              packageName === `@${org}/${libraryName}` ||
              packageName.includes(`/${libraryName}-`) ||
              packageName.includes(`-${libraryName}-`) ||
              packageName.includes(`-${libraryName}`) ||
              new RegExp(`^@${org}/[a-z]+-${libraryName}$`, 'i').test(
                packageName,
              )
            ) {
              libraryId = libraryName
              break
            }
          }
        }

        const now = new Date()

        if (existing) {
          // Update metadata if not checked recently (within last 7 days)
          const shouldUpdate =
            !existing.metadataCheckedAt ||
            now.getTime() - existing.metadataCheckedAt.getTime() >
              7 * 24 * 60 * 60 * 1000

          if (shouldUpdate || existing.libraryId !== libraryId) {
            await db
              .update(npmPackages)
              .set({
                libraryId,
                isLegacy,
                metadataCheckedAt: now,
                updatedAt: now,
              })
              .where(eq(npmPackages.packageName, packageName))
          }
        } else {
          // Register new package
          await db.insert(npmPackages).values({
            packageName,
            libraryId,
            isLegacy,
            metadataCheckedAt: now,
            downloads: null,
            statsExpiresAt: null,
          })
        }
      } catch (error) {
        console.error(
          `[Package Discovery] Error processing ${packageName}:`,
          error instanceof Error ? error.message : String(error),
        )
        // Continue with next package
      }
    }
  } catch (error) {
    console.error(
      '[Package Discovery] Error discovering packages:',
      error instanceof Error ? error.message : String(error),
    )
    throw error
  }
}

/**
 * Compute org stats purely from cached package data in the database
 * This is a fast recalculation that doesn't fetch from NPM API
 */
export async function computeOrgStatsFromCache(org: string): Promise<NpmStats> {
  try {
    const { like, or, eq } = await import('drizzle-orm')

    // Get legacy package names
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

    // Get all packages for this org (e.g., all @tanstack/* packages + legacy packages)
    let packages = await db.query.npmPackages.findMany({
      where: like(npmPackages.packageName, `@${org}/%`),
    })

    // Add legacy packages if they exist in the database
    if (legacyPackages.length > 0) {
      const legacyResults = await db.query.npmPackages.findMany({
        where: or(
          ...legacyPackages.map((pkg) => eq(npmPackages.packageName, pkg)),
        ),
      })
      packages = [...packages, ...legacyResults]
    }

    const packageStats: Record<string, NpmPackageStats> = {}
    let totalDownloads = 0
    let totalRatePerDay = 0

    for (const pkg of packages) {
      if (pkg.downloads !== null) {
        const stats: NpmPackageStats = {
          downloads: pkg.downloads,
        }

        if (pkg.ratePerDay !== null) {
          stats.ratePerDay = pkg.ratePerDay
          totalRatePerDay += pkg.ratePerDay
        }

        packageStats[pkg.packageName] = stats
        totalDownloads += pkg.downloads
      }
    }

    console.log(
      `[Org Stats Recalc] Computed from ${
        packages.length
      } cached packages: ${totalDownloads.toLocaleString()} total downloads, ${Math.round(
        totalRatePerDay,
      ).toLocaleString()}/day`,
    )

    return {
      totalDownloads,
      packageStats,
      ratePerDay: totalRatePerDay > 0 ? totalRatePerDay : undefined,
    }
  } catch (error) {
    console.error(
      `[Org Stats Recalc] Error computing stats for org ${org}:`,
      error instanceof Error ? error.message : String(error),
    )
    return {
      totalDownloads: 0,
      packageStats: {},
    }
  }
}

/**
 * Rebuild all library caches from cached package data
 * This recalculates library stats from the current package data in the database
 */
export async function rebuildLibraryCaches(): Promise<void> {
  try {
    const { libraries } = await import('~/libraries')

    for (const library of libraries) {
      const packages = await db.query.npmPackages.findMany({
        where: eq(npmPackages.libraryId, library.id),
      })

      if (packages.length === 0) continue

      const totalDownloads = packages.reduce(
        (sum, pkg) => sum + (pkg.downloads ?? 0),
        0,
      )

      const existing = await db.query.npmLibraryStatsCache.findFirst({
        where: eq(npmLibraryStatsCache.libraryId, library.id),
      })

      if (existing) {
        await db
          .update(npmLibraryStatsCache)
          .set({
            previousTotalDownloads: existing.totalDownloads,
            totalDownloads,
            packageCount: packages.length,
            updatedAt: new Date(),
          })
          .where(eq(npmLibraryStatsCache.libraryId, library.id))
      } else {
        await db.insert(npmLibraryStatsCache).values({
          libraryId: library.id,
          totalDownloads,
          packageCount: packages.length,
          previousTotalDownloads: null,
        })
      }
    }
  } catch (error) {
    console.error('[Library Stats Cache] Error rebuilding caches:', error)
    throw error
  }
}

/**
 * Get cached GitHub stats if available and not expired
 */
export async function getCachedGitHubStats(cacheKey: string): Promise<{
  stats: GitHubStats
  previousStats: GitHubStats | null
  timeDeltaMs: number
} | null> {
  try {
    const cached = await db.query.githubStatsCache.findFirst({
      where: eq(githubStatsCache.cacheKey, cacheKey),
    })

    if (cached && cached.expiresAt > new Date()) {
      const stats = cached.stats as GitHubStats
      const previousStats = cached.previousStats
        ? (cached.previousStats as GitHubStats)
        : null

      // Calculate time delta from updatedAt and previousUpdatedAt
      let timeDeltaMs = 60 * 60 * 1000 // Default 1 hour
      if (previousStats && cached.updatedAt) {
        // If we have previous stats, calculate time delta
        // We'll use the time between updates as an approximation
        timeDeltaMs = cached.updatedAt.getTime() - cached.createdAt.getTime()
      }

      return {
        stats,
        previousStats,
        timeDeltaMs,
      }
    }

    return null
  } catch (error) {
    console.error('[GitHub Stats Cache] Error reading cache:', error)
    return null
  }
}

/**
 * Get expired GitHub stats cache if available (for fallback when cache is expired)
 */
export async function getExpiredGitHubStats(cacheKey: string): Promise<{
  stats: GitHubStats
  previousStats: GitHubStats | null
  timeDeltaMs: number
} | null> {
  try {
    const cached = await db.query.githubStatsCache.findFirst({
      where: eq(githubStatsCache.cacheKey, cacheKey),
    })

    if (cached) {
      const stats = cached.stats as GitHubStats
      const previousStats = cached.previousStats
        ? (cached.previousStats as GitHubStats)
        : null

      // Calculate time delta from updatedAt and previousUpdatedAt
      let timeDeltaMs = 60 * 60 * 1000 // Default 1 hour
      if (previousStats && cached.updatedAt) {
        timeDeltaMs = cached.updatedAt.getTime() - cached.createdAt.getTime()
      }

      return {
        stats,
        previousStats,
        timeDeltaMs,
      }
    }

    return null
  } catch (error) {
    console.error('[GitHub Stats Cache] Error reading expired cache:', error)
    return null
  }
}

/**
 * Store GitHub stats in cache, preserving previous stats for rate calculation
 */
export async function setCachedGitHubStats(
  cacheKey: string,
  stats: GitHubStats,
  ttlHours: number = 24,
): Promise<void> {
  try {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + ttlHours)
    const now = new Date()

    console.log(
      `[GitHub Stats Cache] Attempting to save cache for ${cacheKey} with stats:`,
      JSON.stringify(stats, null, 2),
    )

    const existing = await db.query.githubStatsCache.findFirst({
      where: eq(githubStatsCache.cacheKey, cacheKey),
    })

    if (existing) {
      // Move current stats to previous, store new stats as current
      await db
        .update(githubStatsCache)
        .set({
          previousStats: existing.stats,
          stats,
          expiresAt,
          updatedAt: now,
        })
        .where(eq(githubStatsCache.cacheKey, cacheKey))
      console.log(
        `[GitHub Stats Cache] ✓ Updated cache for ${cacheKey} (expires at ${expiresAt.toISOString()})`,
      )
    } else {
      // First time - no previous stats yet
      await db.insert(githubStatsCache).values({
        cacheKey,
        stats,
        previousStats: null,
        expiresAt,
      })
      console.log(
        `[GitHub Stats Cache] ✓ Created cache for ${cacheKey} (expires at ${expiresAt.toISOString()})`,
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error(
      `[GitHub Stats Cache] ✗ Error writing cache for ${cacheKey}:`,
      errorMessage,
    )
    if (errorStack) {
      console.error(`[GitHub Stats Cache] Stack trace:`, errorStack)
    }
    // Re-throw the error so the caller knows it failed
    // This allows the refresh function to track failures properly
    throw error
  }
}

/**
 * NPM Download Chunks Cache
 * These functions cache historical date range downloads to avoid repeated API calls
 * and rate limiting. Chunks that are completely in the past are immutable and cached forever.
 */

export interface NpmDownloadChunkData {
  packageName: string
  dateFrom: string // YYYY-MM-DD
  dateTo: string // YYYY-MM-DD
  binSize: string // 'daily', 'weekly', 'monthly'
  totalDownloads: number
  dailyData: Array<{ day: string; downloads: number }>
  isImmutable: boolean
}

/**
 * Get a cached npm download chunk if available
 * Returns the chunk data if found and not expired (for mutable chunks)
 * Immutable chunks (isImmutable=true) never expire
 */
export async function getCachedNpmDownloadChunk(
  packageName: string,
  dateFrom: string,
  dateTo: string,
  binSize: string = 'daily',
): Promise<NpmDownloadChunkData | null> {
  try {
    const cached = await db.query.npmDownloadChunks.findFirst({
      where: and(
        eq(npmDownloadChunks.packageName, packageName),
        eq(npmDownloadChunks.dateFrom, dateFrom),
        eq(npmDownloadChunks.dateTo, dateTo),
        eq(npmDownloadChunks.binSize, binSize),
      ),
    })

    if (!cached) {
      return null
    }

    // Immutable chunks never expire
    if (cached.isImmutable) {
      return {
        packageName: cached.packageName,
        dateFrom: cached.dateFrom,
        dateTo: cached.dateTo,
        binSize: cached.binSize,
        totalDownloads: cached.totalDownloads,
        dailyData: cached.dailyData as Array<{ day: string; downloads: number }>,
        isImmutable: cached.isImmutable,
      }
    }

    // Mutable chunks (recent data) - check expiration
    if (cached.expiresAt && cached.expiresAt > new Date()) {
      return {
        packageName: cached.packageName,
        dateFrom: cached.dateFrom,
        dateTo: cached.dateTo,
        binSize: cached.binSize,
        totalDownloads: cached.totalDownloads,
        dailyData: cached.dailyData as Array<{ day: string; downloads: number }>,
        isImmutable: cached.isImmutable,
      }
    }

    // Expired - return null so it gets refetched
    return null
  } catch (error) {
    console.error(
      `[NPM Download Chunks] Error reading cache for ${packageName} ${dateFrom}:${dateTo}:`,
      error,
    )
    return null
  }
}

/**
 * Store an npm download chunk in the cache
 * Chunks are marked as immutable if they end before today
 * Immutable chunks never expire, mutable chunks expire in 6 hours
 */
export async function setCachedNpmDownloadChunk(
  data: NpmDownloadChunkData,
): Promise<void> {
  try {
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Determine if chunk is immutable (completely in the past)
    const isImmutable = data.dateTo < today

    // Set expiration: null for immutable, 6 hours for mutable
    const expiresAt = isImmutable
      ? null
      : new Date(now.getTime() + 6 * 60 * 60 * 1000)

    // Check if chunk already exists
    const existing = await db.query.npmDownloadChunks.findFirst({
      where: and(
        eq(npmDownloadChunks.packageName, data.packageName),
        eq(npmDownloadChunks.dateFrom, data.dateFrom),
        eq(npmDownloadChunks.dateTo, data.dateTo),
        eq(npmDownloadChunks.binSize, data.binSize),
      ),
    })

    if (existing) {
      // Update existing chunk
      await db
        .update(npmDownloadChunks)
        .set({
          totalDownloads: data.totalDownloads,
          dailyData: data.dailyData,
          isImmutable,
          expiresAt,
          updatedAt: now,
        })
        .where(eq(npmDownloadChunks.id, existing.id))

      console.log(
        `[NPM Download Chunks] ✓ Updated ${data.packageName} ${data.dateFrom}:${data.dateTo} (${data.totalDownloads.toLocaleString()} downloads, ${isImmutable ? 'immutable' : 'expires ' + expiresAt?.toISOString()})`,
      )
    } else {
      // Insert new chunk
      await db.insert(npmDownloadChunks).values({
        packageName: data.packageName,
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
        binSize: data.binSize,
        totalDownloads: data.totalDownloads,
        dailyData: data.dailyData,
        isImmutable,
        expiresAt,
      })

      console.log(
        `[NPM Download Chunks] ✓ Cached ${data.packageName} ${data.dateFrom}:${data.dateTo} (${data.totalDownloads.toLocaleString()} downloads, ${isImmutable ? 'immutable' : 'expires ' + expiresAt?.toISOString()})`,
      )
    }
  } catch (error) {
    console.error(
      `[NPM Download Chunks] ✗ Error caching ${data.packageName} ${data.dateFrom}:${data.dateTo}:`,
      error,
    )
    // Don't throw - caching is best-effort
  }
}
