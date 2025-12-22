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
  packageNames: string[],
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
  const { getCachedNpmOrgStats, getExpiredNpmOrgStats } =
    await import('./stats-db.server')

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
  timeDeltaMs: number,
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
    }),
  )
  .handler(async ({ data }): Promise<OSSStatsWithDelta> => {
    // Add HTTP caching headers for better performance
    // Cache for 5 minutes on CDN, allow stale content for up to 1 hour
    setResponseHeaders(
      new Headers({
        'Cache-Control':
          'public, max-age=300, stale-while-revalidate=3600, stale-if-error=3600',
        'Netlify-CDN-Cache-Control':
          'public, max-age=300, durable, stale-while-revalidate=3600',
      }),
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
          npmPackageNames,
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
    let previousGitHubStats: GitHubStats | null
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
      githubTimeDeltaMs,
    )
  })

/**
 * Fetch NPM download data for multiple packages in bulk
 * Optimized to handle all packages in a single request with batch cache lookup
 * and parallel NPM API fetching. Current year data is cached daily.
 */
export const fetchNpmDownloadsBulk = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      packageGroups: z.array(
        z.object({
          packages: z.array(
            z.object({
              name: z.string(),
              hidden: z.boolean().optional(),
            }),
          ),
        }),
      ),
      startDate: z.string(), // YYYY-MM-DD
      endDate: z.string(), // YYYY-MM-DD
    }),
  )
  .handler(async ({ data }) => {
    const { packageGroups, startDate, endDate } = data

    // Import cache functions
    const { getBatchNpmDownloadChunks, setCachedNpmDownloadChunk } =
      await import('./stats-db.server')

    const NPM_STATS_START_DATE = '2015-01-10'
    const today = new Date().toISOString().substring(0, 10)
    const currentYear = new Date().getFullYear().toString()

    // Collect all unique package/year combinations needed
    interface ChunkRequest {
      packageName: string
      year: string
      startDate: string
      endDate: string
      isCurrentYear: boolean
    }

    const chunkRequests: ChunkRequest[] = []
    const allPackageNames = new Set<string>()

    for (const group of packageGroups) {
      for (const pkg of group.packages) {
        allPackageNames.add(pkg.name)

        // Generate year-based chunks from startDate to endDate
        const startYear = new Date(startDate).getFullYear()
        const endYear = new Date(endDate).getFullYear()

        for (let year = startYear; year <= endYear; year++) {
          const yearStr = year.toString()
          const isCurrentYear = yearStr === currentYear

          let chunkStart = `${yearStr}-01-01`
          let chunkEnd = `${yearStr}-12-31`

          if (isCurrentYear) {
            chunkEnd = today
          }

          // Adjust start date if before npm stats started
          if (chunkStart < NPM_STATS_START_DATE) {
            chunkStart = NPM_STATS_START_DATE
          }

          // Skip future years
          if (year > parseInt(currentYear)) {
            continue
          }

          chunkRequests.push({
            packageName: pkg.name,
            year: yearStr,
            startDate: chunkStart,
            endDate: chunkEnd,
            isCurrentYear,
          })
        }
      }
    }

    // Batch fetch all chunks from cache
    const cachedChunks = await getBatchNpmDownloadChunks(
      chunkRequests.map((req) => ({
        packageName: req.packageName,
        dateFrom: req.startDate,
        dateTo: req.endDate,
        binSize: 'daily',
      })),
    )

    // Identify chunks that need to be fetched from NPM API
    const chunksToFetch: ChunkRequest[] = []
    const resultChunks = new Map<string, any>()

    for (const req of chunkRequests) {
      const cacheKey = `${req.packageName}|${req.startDate}|${req.endDate}|daily`
      const cached = cachedChunks.get(cacheKey)

      if (cached) {
        // For current year, check if cache is from today
        if (req.isCurrentYear && !cached.isImmutable) {
          // Check if the cache was updated today
          const cacheDate = new Date(cached.updatedAt || 0)
            .toISOString()
            .substring(0, 10)
          if (cacheDate === today) {
            // Cache is from today, use it
            resultChunks.set(cacheKey, cached)
            continue
          }
          // Cache is stale, need to refetch
          chunksToFetch.push(req)
        } else {
          // Immutable historical data, always use cache
          resultChunks.set(cacheKey, cached)
        }
      } else {
        // Not in cache, need to fetch
        chunksToFetch.push(req)
      }
    }

    // Fetch missing chunks from NPM API in parallel
    if (chunksToFetch.length > 0) {
      const fetchPromises = chunksToFetch.map(async (req) => {
        try {
          const response = await fetch(
            `https://api.npmjs.org/downloads/range/${req.startDate}:${req.endDate}/${req.packageName}`,
            {
              headers: {
                Accept: 'application/json',
                'User-Agent': 'TanStack-Stats',
              },
            },
          )

          if (!response.ok) {
            if (response.status === 404) {
              return {
                key: `${req.packageName}|${req.startDate}|${req.endDate}|daily`,
                data: {
                  packageName: req.packageName,
                  dateFrom: req.startDate,
                  dateTo: req.endDate,
                  dailyData: [],
                  totalDownloads: 0,
                  isImmutable: !req.isCurrentYear,
                },
              }
            }
            throw new Error(`NPM API error: ${response.status}`)
          }

          const result = await response.json()
          const downloads = result.downloads || []

          const chunkData = {
            packageName: req.packageName,
            dateFrom: req.startDate,
            dateTo: req.endDate,
            binSize: 'daily',
            totalDownloads: downloads.reduce(
              (sum: number, d: any) => sum + d.downloads,
              0,
            ),
            dailyData: downloads,
            isImmutable: !req.isCurrentYear,
          }

          // Cache this chunk asynchronously (don't wait)
          setCachedNpmDownloadChunk(chunkData).catch((err) =>
            console.warn(`Failed to cache chunk for ${req.packageName}:`, err),
          )

          return {
            key: `${req.packageName}|${req.startDate}|${req.endDate}|daily`,
            data: chunkData,
          }
        } catch (error) {
          console.error(
            `Failed to fetch ${req.packageName} ${req.year}:`,
            error,
          )
          // Return empty data on error
          return {
            key: `${req.packageName}|${req.startDate}|${req.endDate}|daily`,
            data: {
              packageName: req.packageName,
              dateFrom: req.startDate,
              dateTo: req.endDate,
              dailyData: [],
              totalDownloads: 0,
              isImmutable: !req.isCurrentYear,
            },
          }
        }
      })

      const fetchedResults = await Promise.all(fetchPromises)
      for (const result of fetchedResults) {
        resultChunks.set(result.key, result.data)
      }
    }

    // Organize results by package group
    const results = packageGroups.map((group) => {
      const packages = group.packages.map((pkg) => {
        // Collect all chunks for this package
        const packageChunks: any[] = []

        for (const req of chunkRequests) {
          if (req.packageName === pkg.name) {
            const cacheKey = `${req.packageName}|${req.startDate}|${req.endDate}|daily`
            const chunk = resultChunks.get(cacheKey)
            if (chunk) {
              packageChunks.push(chunk)
            }
          }
        }

        // Combine all chunks and filter to requested date range
        const allDownloads = packageChunks
          .flatMap((chunk) => chunk.dailyData || [])
          .filter((d: any) => {
            const date = new Date(d.day)
            return date >= new Date(startDate) && date <= new Date(endDate)
          })
          .sort(
            (a: any, b: any) =>
              new Date(a.day).getTime() - new Date(b.day).getTime(),
          )

        return {
          name: pkg.name,
          hidden: pkg.hidden,
          downloads: allDownloads,
        }
      })

      return {
        packages,
        start: startDate,
        end: endDate,
        error: null,
      }
    })

    // Set cache headers for CDN caching
    // Cache for 1 hour since we're now handling daily caching internally
    setResponseHeaders(
      new Headers({
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
        'Netlify-CDN-Cache-Control':
          'public, max-age=3600, durable, stale-while-revalidate=7200',
      }),
    )

    return results
  })

/**
 * Fetch recent download statistics for daily, weekly, and monthly periods
 * Uses the same getRegisteredPackages logic to include all library adapters
 */
export const fetchRecentDownloadStats = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      library: z.object({
        id: z.string(),
        repo: z.string(),
        frameworks: z.array(z.string()).optional(),
      }),
    }),
  )
  .handler(async ({ data }) => {
    // Add HTTP caching headers
    setResponseHeaders({
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'Netlify-CDN-Cache-Control':
        'public, max-age=300, durable, stale-while-revalidate=3600',
    })

    // Import db functions dynamically
    const {
      getRegisteredPackages,
      getBatchNpmDownloadChunks,
      setCachedNpmDownloadChunk,
    } = await import('./stats-db.server')

    // Get registered packages for this library (same as getOSSStats)
    let npmPackageNames = await getRegisteredPackages(data.library.id)

    // If no packages are registered yet, fall back to basic package name
    if (npmPackageNames.length === 0) {
      npmPackageNames = [`@tanstack/${data.library.id}`]
    }

    const today = new Date()
    const todayStr = today.toISOString().substring(0, 10)

    // Calculate date ranges
    const dailyStart = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .substring(0, 10)
    const weeklyStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .substring(0, 10)
    const monthlyStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .substring(0, 10)

    // Create chunk requests for all packages and time periods
    const chunkRequests = []
    for (const packageName of npmPackageNames) {
      // Daily data (last 24 hours)
      chunkRequests.push({
        packageName,
        dateFrom: dailyStart,
        dateTo: todayStr,
        binSize: 'daily',
        period: 'daily',
      })
      // Weekly data (last 7 days)
      chunkRequests.push({
        packageName,
        dateFrom: weeklyStart,
        dateTo: todayStr,
        binSize: 'daily',
        period: 'weekly',
      })
      // Monthly data (last 30 days)
      chunkRequests.push({
        packageName,
        dateFrom: monthlyStart,
        dateTo: todayStr,
        binSize: 'daily',
        period: 'monthly',
      })
    }

    // Try to get cached data first
    const cachedChunks = await getBatchNpmDownloadChunks(chunkRequests)
    const needsFetch: typeof chunkRequests = []
    const results = new Map<string, any>()

    // Check what we have in cache vs what needs fetching
    for (const req of chunkRequests) {
      const cacheKey = `${req.packageName}|${req.dateFrom}|${req.dateTo}|${req.binSize}`
      const cached = cachedChunks.get(cacheKey)

      if (cached) {
        // Check if cache is recent enough (within last hour for recent data)
        const cacheAge = Date.now() - (cached.updatedAt ?? 0)
        const isStale = cacheAge > 60 * 60 * 1000 // 1 hour

        if (!isStale) {
          results.set(cacheKey, cached)
          continue
        }
      }

      needsFetch.push(req)
    }

    // Fetch missing/stale data from NPM API
    if (needsFetch.length > 0) {
      const fetchPromises = needsFetch.map(async (req) => {
        try {
          const response = await fetch(
            `https://api.npmjs.org/downloads/range/${req.dateFrom}:${req.dateTo}/${req.packageName}`,
            {
              headers: {
                Accept: 'application/json',
                'User-Agent': 'TanStack-Stats',
              },
            },
          )

          if (!response.ok) {
            if (response.status === 404) {
              // Package not found, return zero data
              return {
                key: `${req.packageName}|${req.dateFrom}|${req.dateTo}|${req.binSize}`,
                data: {
                  packageName: req.packageName,
                  dateFrom: req.dateFrom,
                  dateTo: req.dateTo,
                  binSize: req.binSize,
                  dailyData: [],
                  totalDownloads: 0,
                  isImmutable: false,
                  updatedAt: Date.now(),
                },
              }
            }
            throw new Error(`NPM API error: ${response.status}`)
          }

          const result = await response.json()
          const downloads = result.downloads || []

          const chunkData = {
            packageName: req.packageName,
            dateFrom: req.dateFrom,
            dateTo: req.dateTo,
            binSize: req.binSize,
            totalDownloads: downloads.reduce(
              (sum: number, d: any) => sum + d.downloads,
              0,
            ),
            dailyData: downloads,
            isImmutable: false, // Recent data is mutable
            updatedAt: Date.now(),
          }

          // Cache this chunk asynchronously
          setCachedNpmDownloadChunk(chunkData).catch((err) =>
            console.warn(
              `Failed to cache recent downloads for ${req.packageName}:`,
              err,
            ),
          )

          return {
            key: `${req.packageName}|${req.dateFrom}|${req.dateTo}|${req.binSize}`,
            data: chunkData,
          }
        } catch (error) {
          console.error(
            `Failed to fetch recent downloads for ${req.packageName}:`,
            error,
          )
          // Return zero data on error
          return {
            key: `${req.packageName}|${req.dateFrom}|${req.dateTo}|${req.binSize}`,
            data: {
              packageName: req.packageName,
              dateFrom: req.dateFrom,
              dateTo: req.dateTo,
              binSize: req.binSize,
              dailyData: [],
              totalDownloads: 0,
              isImmutable: false,
              updatedAt: Date.now(),
            },
          }
        }
      })

      const fetchResults = await Promise.all(fetchPromises)
      for (const result of fetchResults) {
        results.set(result.key, result.data)
      }
    }

    // Aggregate results by time period
    let dailyTotal = 0
    let weeklyTotal = 0
    let monthlyTotal = 0

    for (const req of chunkRequests) {
      const cacheKey = `${req.packageName}|${req.dateFrom}|${req.dateTo}|${req.binSize}`
      const chunk = results.get(cacheKey)

      if (chunk) {
        const downloads = chunk.totalDownloads || 0

        if (req.period === 'daily') {
          dailyTotal += downloads
        } else if (req.period === 'weekly') {
          weeklyTotal += downloads
        } else if (req.period === 'monthly') {
          monthlyTotal += downloads
        }
      }
    }

    return {
      dailyDownloads: dailyTotal,
      weeklyDownloads: weeklyTotal,
      monthlyDownloads: monthlyTotal,
    }
  })

/**
 * Fetch NPM download data for a package for a specific chunk
 * Uses standardized year-based chunks for maximum cache reuse
 * GET request with fixed boundaries allows CDN and browser caching
 *
 * Chunk format: YYYY (e.g., "2023" means Jan 1 - Dec 31, 2023)
 * Special chunk "current" means current year to date
 */
export const fetchNpmDownloadChunk = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      packageName: z.string(),
      year: z.string(), // YYYY format or "current" for current year
    }),
  )
  .handler(async ({ data }) => {
    const { packageName, year } = data

    // NPM download statistics only go back to January 10, 2015
    const NPM_STATS_START_DATE = '2015-01-10'
    const today = new Date().toISOString().substring(0, 10)
    const currentYear = new Date().getFullYear().toString()

    // Determine date range for this chunk
    let startDate: string
    let endDate: string
    const isCurrentYear = year === 'current' || year === currentYear

    if (year === 'current') {
      // Current year to date
      startDate = `${currentYear}-01-01`
      endDate = today
    } else {
      // Full year
      startDate = `${year}-01-01`
      endDate = `${year}-12-31`

      // Don't fetch future years
      if (parseInt(year) > parseInt(currentYear)) {
        return {
          start: startDate,
          end: endDate,
          package: packageName,
          year,
          downloads: [],
        }
      }
    }

    // Adjust start date if before npm stats started
    if (startDate < NPM_STATS_START_DATE) {
      startDate = NPM_STATS_START_DATE
    }

    // Set aggressive cache headers for immutable historical data
    // Current year data changes daily, historical data is immutable
    const cacheMaxAge = isCurrentYear ? 3600 : 31536000 // 1 hour / 1 year
    const cdnMaxAge = isCurrentYear ? 3600 : 31536000 // 1 hour / 1 year

    setResponseHeaders({
      // Use Netlify-specific header for best performance
      // 'durable' shares cached responses across all edge nodes
      'Netlify-CDN-Cache-Control': `public, max-age=${cdnMaxAge}, durable${isCurrentYear ? '' : ', stale-while-revalidate=86400'}`,
      // Also set standard Cache-Control for browser caching
      'Cache-Control': `public, max-age=${cacheMaxAge}`,
    })

    // Import cache functions
    const { getCachedNpmDownloadChunk, setCachedNpmDownloadChunk } =
      await import('./stats-db.server')

    // Check database cache first
    let cachedChunk
    try {
      cachedChunk = await getCachedNpmDownloadChunk(
        packageName,
        startDate,
        endDate,
        'daily',
      )
    } catch (error) {
      console.warn(
        `[NPM Download Chunk] Cache lookup error for ${packageName} ${year}:`,
        error,
      )
    }

    // Use cache if available and immutable
    if (cachedChunk) {
      if (cachedChunk.isImmutable) {
        return {
          start: cachedChunk.dateFrom,
          end: cachedChunk.dateTo,
          package: packageName,
          year,
          downloads: cachedChunk.dailyData,
        }
      }
      // For current year, check if cache is still fresh (within 1 hour)
      // If expired, fall through to fetch fresh data
    }

    // Fetch from NPM API
    try {
      const response = await fetch(
        `https://api.npmjs.org/downloads/range/${startDate}:${endDate}/${packageName}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'TanStack-Stats',
          },
        },
      )

      if (!response.ok) {
        if (response.status === 404) {
          // Package not found or no data for this range
          console.warn(`[NPM Download Chunk] 404 for ${packageName} ${year}`)
          return {
            start: startDate,
            end: endDate,
            package: packageName,
            year,
            downloads: [],
          }
        }
        if (response.status === 429) {
          // Rate limited - use cached data if available
          if (cachedChunk) {
            console.warn(
              `[NPM Download Chunk] Rate limited, using cached data for ${packageName} ${year}`,
            )
            return {
              start: cachedChunk.dateFrom,
              end: cachedChunk.dateTo,
              package: packageName,
              year,
              downloads: cachedChunk.dailyData,
            }
          }
          throw new Error(
            'NPM API rate limit exceeded. Please try again in a moment.',
          )
        }
        throw new Error(
          `NPM API error for ${packageName} ${year}: ${response.status}`,
        )
      }

      const result = await response.json()
      const downloads = result.downloads || []

      // Cache this chunk
      try {
        const isImmutable = !isCurrentYear
        await setCachedNpmDownloadChunk({
          packageName,
          dateFrom: startDate,
          dateTo: endDate,
          binSize: 'daily',
          totalDownloads: downloads.reduce(
            (sum: number, d: any) => sum + d.downloads,
            0,
          ),
          dailyData: downloads,
          isImmutable,
        })
      } catch (error) {
        console.warn(
          `[NPM Download Chunk] Cache write error for ${packageName} ${year}:`,
          error,
        )
      }

      return {
        start: result.start || startDate,
        end: result.end || endDate,
        package: packageName,
        year,
        downloads,
      }
    } catch (error) {
      // If fetch fails and we have cached data, use that
      if (cachedChunk) {
        console.warn(
          `[NPM Download Chunk] Fetch failed, using cached data for ${packageName} ${year}`,
        )
        return {
          start: cachedChunk.dateFrom,
          end: cachedChunk.dateTo,
          package: packageName,
          year,
          downloads: cachedChunk.dailyData,
        }
      }
      throw error
    }
  })
