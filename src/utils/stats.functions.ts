/**
 * Pure stats functions that can be used by both TanStack Start server functions
 * and Worker cron tasks. No TanStack Start dependencies.
 */

import { envFunctions } from './env.functions'
import type { GitHubStats, NpmPackageStats, NpmStats } from './stats.types'
import {
  getNormalizedNpmDownloadChunks,
  getNpmDailyDownloadsFromResponse,
  getNpmDownloadResponseError,
  hasCompleteDailyCoverage,
} from './npm-download-ranges'

function getGitHubHeaders() {
  const token = envFunctions.GITHUB_AUTH_TOKEN

  return {
    ...(token && token !== 'USE_A_REAL_KEY_IN_PRODUCTION'
      ? { Authorization: `Bearer ${token}` }
      : {}),
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'TanStack-Stats',
  }
}

/**
 * Fetch GitHub repository statistics
 */
export async function fetchGitHubRepoStats(repo: string): Promise<GitHubStats> {
  const repoData = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: getGitHubHeaders(),
  }).then(async (res) => {
    if (!res.ok) {
      // Check for rate limiting
      if (res.status === 403) {
        const rateLimitRemaining = res.headers.get('X-RateLimit-Remaining')
        if (rateLimitRemaining === '0') {
          const rateLimitReset = res.headers.get('X-RateLimit-Reset')
          const resetTime = rateLimitReset
            ? new Date(parseInt(rateLimitReset, 10) * 1000)
            : new Date(Date.now() + 60 * 60 * 1000)
          throw new Error(
            `GitHub API rate limit exceeded. Resets at: ${resetTime.toISOString()}`,
          )
        }
      }
      const errorText = await res.text().catch(() => 'Unknown error')
      throw new Error(`GitHub API error: ${res.status} - ${errorText}`)
    }
    return res.json()
  })

  return {
    starCount: repoData.stargazers_count ?? 0,
    contributorCount: 0,
    dependentCount: 0,
    forkCount: repoData.forks_count ?? 0,
  }
}

/**
 * Fetch GitHub organization statistics (aggregate across all repos)
 */
export async function fetchGitHubOwnerStats(
  owner: string,
): Promise<GitHubStats> {
  // Fetch all repos for the organization
  const repos: any[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await fetch(
      `https://api.github.com/orgs/${owner}/repos?per_page=100&page=${page}&sort=stars`,
      {
        headers: getGitHubHeaders(),
      },
    )

    if (!response.ok) {
      // Handle rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
        const rateLimitReset = response.headers.get('X-RateLimit-Reset')

        if (rateLimitRemaining === '0') {
          const resetTime = rateLimitReset
            ? new Date(parseInt(rateLimitReset, 10) * 1000)
            : new Date(Date.now() + 60 * 60 * 1000) // Default to 1 hour
          console.error(
            `[GitHub API] Rate limit exceeded. Resets at: ${resetTime.toISOString()}`,
          )
          throw new Error(
            `GitHub API rate limit exceeded. Resets at: ${resetTime.toISOString()}`,
          )
        }

        // 403 without rate limit means permission issue
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(
          `[GitHub API] 403 Forbidden for org/${owner}. Token may lack required permissions. Error: ${errorText}`,
        )
        throw new Error(
          `GitHub API 403 Forbidden. Token may lack required permissions for organization access.`,
        )
      }

      // Handle other errors
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(
        `[GitHub API] Error ${response.status} fetching org/${owner}: ${errorText}`,
      )
      throw new Error(`GitHub API error: ${response.status} - ${errorText}`)
    }

    const pageRepos = await response.json()
    repos.push(...pageRepos)

    // Check if there are more pages
    const linkHeader = response.headers.get('Link')
    hasMore = linkHeader?.includes('rel="next"') ?? false
    page++
  }

  // Aggregate stats
  const starCount = repos.reduce(
    (sum, repo) => sum + (repo.stargazers_count ?? 0),
    0,
  )

  const forkCount = repos.reduce(
    (sum, repo) => sum + (repo.forks_count ?? 0),
    0,
  )

  return {
    starCount,
    contributorCount: 0,
    dependentCount: 0,
    forkCount,
    repositoryCount: repos.length,
  }
}

/**
 * Fetch package creation date from npm registry
 */
async function fetchNpmPackageCreationDate(
  packageName: string,
): Promise<string> {
  try {
    const response = await fetch(
      `https://registry.npmjs.com/${encodeURIComponent(packageName)}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TanStack-Stats',
        },
      },
    )

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`NPM package not found: ${packageName}`)
      }

      console.warn(
        `[NPM Stats] Could not fetch creation date for ${packageName}, using 2015-01-10`,
      )
      return '2015-01-10' // npm download data starts from this date
    }

    const data = await response.json()
    return data.time?.created || '2015-01-10'
  } catch (error) {
    console.warn(
      `[NPM Stats] Error fetching creation date for ${packageName}:`,
      error instanceof Error ? error.message : String(error),
    )
    return '2015-01-10' // npm download data starts from this date
  }
}

/**
 * Fetch all-time download counts using chunked /range/ requests
 * This is the correct method as npm API limits /point/ to 18 months
 *
 * Uses normalized chunk boundaries for consistent caching across runs
 * Fetches chunks sequentially (concurrency controlled at package level)
 * Returns total downloads and daily rate (average from last full week)
 */
export type FetchNpmPackageDownloadsOptions = {
  forceRefresh?: boolean
}

function shouldUseCachedNpmDownloadChunk({
  cachedChunk,
  chunkTo,
  createdDate,
  forceRefresh,
}: {
  cachedChunk: {
    dailyData: Array<{ day: string; downloads: number }>
    totalDownloads: number
  }
  chunkTo: string
  createdDate: string
  forceRefresh: boolean
}) {
  if (forceRefresh) {
    return false
  }

  if (cachedChunk.totalDownloads !== 0 || cachedChunk.dailyData.length > 0) {
    return true
  }

  const createdDay = createdDate.slice(0, 10)
  return createdDay > chunkTo
}

async function fetchNpmPackageDownloadsChunked(
  packageName: string,
  createdDate: string,
  options: FetchNpmPackageDownloadsOptions = {},
): Promise<{ totalDownloads: number; ratePerDay: number }> {
  const today = new Date().toISOString().substring(0, 10)

  // Generate normalized chunks for consistent cache keys
  const chunks = getNormalizedNpmDownloadChunks({
    startDate: createdDate,
    endDate: today,
    today,
  })

  let totalDownloadCount = 0
  let lastChunkData: { day: string; downloads: number }[] = []

  // Load cache functions dynamically to keep the shared stats module light.
  const { getCachedNpmDownloadChunk, setCachedNpmDownloadChunk } =
    await import('./npm-download-cache.server')

  // Fetch chunks sequentially to avoid nested AsyncQueuer complexity
  // The outer queue (per-package) provides concurrency control
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    let success = false

    // Check cache first (gracefully handle if migration not run)
    let cachedChunk = null
    try {
      cachedChunk = await getCachedNpmDownloadChunk(
        packageName,
        chunk.from,
        chunk.to,
        'daily',
      )
    } catch (error) {
      // Cache table doesn't exist yet (migration not run) - gracefully continue
      if (
        error instanceof Error &&
        (error.message.includes('relation') ||
          error.message.includes('does not exist'))
      ) {
        // Silently skip cache on first error, then stop trying
        if (i === 0) {
          console.log(
            `[NPM Stats] Cache table not available (migration not run), skipping cache`,
          )
        }
      } else {
        // Other errors - log but continue
        console.warn(
          `[NPM Stats] Cache lookup error for ${packageName}:`,
          error,
        )
      }
    }

    if (
      cachedChunk &&
      shouldUseCachedNpmDownloadChunk({
        cachedChunk,
        chunkTo: chunk.to,
        createdDate,
        forceRefresh: options.forceRefresh ?? false,
      })
    ) {
      // For mutable chunks, always fetch fresh data from npm API
      // Immutable chunks can use cache since they won't change
      if (!cachedChunk.isImmutable) {
        console.log(
          `[NPM Stats] ${packageName} chunk ${chunk.from}:${chunk.to}: mutable chunk, fetching fresh data from npm API`,
        )
        // Fall through to fetch from API
      } else {
        // Use cached immutable data
        console.log(
          `[NPM Stats] ${packageName} chunk ${chunk.from}:${
            chunk.to
          }: using cache (${cachedChunk.totalDownloads.toLocaleString()} downloads, immutable)`,
        )
        totalDownloadCount += cachedChunk.totalDownloads
        if (cachedChunk.dailyData.length > 0) {
          lastChunkData = cachedChunk.dailyData
        }
        continue // Skip to next chunk
      }
    }

    // Not in cache - fetch from NPM API
    // Retry loop with indefinite retries for rate limiting
    while (!success) {
      try {
        const response = await fetch(
          `https://api.npmjs.org/downloads/range/${chunk.from}:${chunk.to}/${encodeURIComponent(packageName)}`,
          {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'TanStack-Stats',
            },
          },
        )

        if (!response.ok) {
          if (response.status === 404) {
            if (chunk.to >= createdDate.slice(0, 10)) {
              throw new Error(
                `NPM API returned 404 for ${packageName} ${chunk.from}:${chunk.to}`,
              )
            }

            console.log(
              `[NPM Stats] ${packageName} chunk ${chunk.from}:${chunk.to}: not found`,
            )
            success = true // Exit retry loop
            continue
          }
          if (response.status === 429) {
            // Rate limited - wait and retry indefinitely
            // Note: NPM's Retry-After header is unreliable (often returns "0")
            // Use fixed 5 second wait time instead
            const waitTime = 5000 // 5 seconds
            console.warn(
              `[NPM Stats] Rate limited on ${packageName} chunk ${chunk.from}:${chunk.to}, waiting ${waitTime}ms...`,
            )
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            continue // Retry this chunk
          }
          throw new Error(`NPM API error: ${response.status}`)
        }

        const pageData: unknown = await response.json()

        if (
          getNpmDownloadResponseError(pageData) ===
          `package ${packageName} not found`
        ) {
          if (chunk.to >= createdDate.slice(0, 10)) {
            throw new Error(
              `NPM API returned package-not-found for ${packageName} ${chunk.from}:${chunk.to}`,
            )
          }

          success = true // Exit retry loop
          continue
        }

        const downloads = getNpmDailyDownloadsFromResponse(pageData)

        if (!hasCompleteDailyCoverage(downloads, chunk.from, chunk.to)) {
          throw new Error(
            `NPM API returned incomplete range ${downloads[0]?.day ?? 'empty'}:${downloads.at(-1)?.day ?? 'empty'} for ${chunk.from}:${chunk.to}`,
          )
        }

        const downloadCount = downloads.reduce(
          (acc, cur) => acc + cur.downloads,
          0,
        )

        totalDownloadCount += downloadCount
        if (downloads.length > 0) {
          lastChunkData = downloads
        }

        // Cache the fetched chunk for future use (best-effort)
        try {
          await setCachedNpmDownloadChunk({
            packageName,
            dateFrom: chunk.from,
            dateTo: chunk.to,
            binSize: 'daily',
            totalDownloads: downloadCount,
            dailyData: downloads,
            isImmutable: false, // Will be calculated by setCachedNpmDownloadChunk
          })
        } catch (error) {
          // Cache write failed - not critical, continue anyway
          // This can happen if migration hasn't been run yet
        }

        success = true // Successfully processed this chunk
      } catch (error) {
        // For non-rate-limit errors, throw to fail the whole package
        console.error(
          `[NPM Stats] Error fetching chunk ${chunk.from}:${chunk.to} for ${packageName}:`,
          error instanceof Error ? error.message : String(error),
        )
        throw error
      }
    }
  }

  // Calculate daily average from last full week of data
  const lastWeek = lastChunkData.slice(-7)
  let ratePerDay = 0

  if (lastWeek.length === 7) {
    const weekTotal = lastWeek.reduce((sum, day) => sum + day.downloads, 0)
    ratePerDay = weekTotal / 7
  }

  return { totalDownloads: totalDownloadCount, ratePerDay }
}

/**
 * Fetch a single NPM package download statistic with retries (for scheduled tasks)
 * This version actually fetches from the API when cache is expired
 * Uses chunked /range/ requests to get accurate all-time download counts
 */
export async function fetchSingleNpmPackageFresh(
  packageName: string,
  retries: number = 3,
  options: FetchNpmPackageDownloadsOptions = {},
): Promise<NpmPackageStats> {
  // Import db functions dynamically to avoid pulling server code into client bundle
  const { setCachedNpmPackageStats } = await import('./stats-db.server')

  // Cache miss or skip cache - fetch from API
  let attempt = 0
  let lastError: Error | null = null

  while (attempt < retries) {
    try {
      // Get package creation date
      const createdDate = await fetchNpmPackageCreationDate(packageName)

      // Fetch all-time downloads using chunked range requests
      // This is the correct method as /point/ is limited to 18 months
      const result = await fetchNpmPackageDownloadsChunked(
        packageName,
        createdDate,
        options,
      )

      // Capture timestamp when data was fetched
      const updatedAt = Date.now()

      // Store in cache with calculated rate
      await setCachedNpmPackageStats(
        packageName,
        result.totalDownloads,
        24,
        result.ratePerDay,
      )

      return {
        downloads: result.totalDownloads,
        ratePerDay: result.ratePerDay,
        updatedAt,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      attempt++

      if (attempt < retries) {
        const waitTime = Math.pow(2, attempt) * 1000
        console.warn(
          `[NPM Stats] Error fetching ${packageName}, retrying in ${waitTime}ms...`,
          lastError.message,
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      } else {
        console.error(
          `[NPM Stats] Error fetching ${packageName} after all retries:`,
          lastError.message,
        )
        throw lastError
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${packageName}`)
}

export async function getNpmOrgPackageNames(org: string): Promise<string[]> {
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
    console.error(
      `[NPM Stats] Org packages fetch failed: ${response.status} ${response.statusText}`,
    )
    throw new Error(`NPM API error: ${response.status}`)
  }

  const data = await response.json()
  const packageNames = Object.keys(data)

  if (packageNames.length === 0) {
    console.error(`[NPM Stats] No packages found for org ${org}`)
    return []
  }

  const { libraries } = await import('~/libraries')
  const legacyPackages = libraries.flatMap(
    (library) => library.legacyPackages ?? [],
  )

  return [...new Set([...packageNames, ...legacyPackages])]
}

export async function refreshNpmPackageStatsBatch(
  packageNames: string[],
  options: FetchNpmPackageDownloadsOptions = {},
): Promise<{
  failed: Array<{ error: string; packageName: string }>
  fallback: Array<string>
  refreshed: Array<string>
}> {
  const { getBatchCachedNpmPackageStats } = await import('./stats-db.server')
  const cachedPackageStats = await getBatchCachedNpmPackageStats(packageNames)
  const failed: Array<{ error: string; packageName: string }> = []
  const fallback: Array<string> = []
  const refreshed: Array<string> = []

  for (const packageName of packageNames) {
    try {
      await fetchSingleNpmPackageFresh(packageName, 3, options)
      refreshed.push(packageName)
    } catch (error) {
      const cachedStats = cachedPackageStats.get(packageName)
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      if (cachedStats && cachedStats.downloads > 0) {
        fallback.push(packageName)
        console.warn(
          `[NPM Stats] Failed ${packageName}, keeping cached stats: ${errorMessage}`,
        )
      } else {
        failed.push({ packageName, error: errorMessage })
        console.error(
          `[NPM Stats] Failed ${packageName} with no cached stats: ${errorMessage}`,
        )
      }
    }
  }

  return { failed, fallback, refreshed }
}

/**
 * Compute NPM organization statistics (expensive operation)
 * Fetches all packages and aggregates their stats
 * Uses cached immutable chunks by default, or bypasses chunk cache when
 * forceRefresh is enabled for admin repair operations.
 */
export async function computeNpmOrgStats(
  org: string,
  options: FetchNpmPackageDownloadsOptions = {},
): Promise<NpmStats> {
  // Fetch all packages in the org
  let retries = 3
  let lastError: Error | null = null

  while (retries > 0) {
    try {
      const packageNames = await getNpmOrgPackageNames(org)

      if (packageNames.length === 0) {
        return { totalDownloads: 0, packageStats: {} }
      }

      const { getBatchCachedNpmPackageStats } =
        await import('./stats-db.server')
      const cachedPackageStats =
        await getBatchCachedNpmPackageStats(packageNames)

      // Fetch fresh data for all packages. If a package fetch fails, reuse the
      // previous package value so a transient npm outage cannot deflate totals.
      const results = new Map<string, NpmPackageStats>()
      const uncachedFailures: Array<{ packageName: string; error: string }> = []

      // Fetch packages using single AsyncQueuer (chunks are sequential within each package)
      const { AsyncQueuer } = await import('@tanstack/pacer')
      let successCount = 0
      let failCount = 0
      let fallbackCount = 0

      await new Promise<void>((resolve) => {
        const checkIdle = () => {
          if (successCount + failCount >= packageNames.length) {
            console.log(
              `[NPM Stats] Completed: ${successCount} successful, ${failCount} failed`,
            )
            resolve()
          }
        }

        const queue = new AsyncQueuer(
          async (packageName: string) => {
            return await fetchSingleNpmPackageFresh(packageName, 3, options)
          },
          {
            concurrency: 8, // Process 8 packages concurrently (reduced from 15 to avoid rate limiting)
            wait: 500, // Wait 500ms between starting new packages (increased from 50ms)
            started: true,
            onSuccess: (stats, packageName) => {
              results.set(packageName, stats)
              successCount++

              // Progress update every 50 packages
              if ((successCount + failCount) % 50 === 0) {
                console.log(
                  `[NPM Stats] Progress: ${successCount + failCount}/${
                    packageNames.length
                  } packages`,
                )
              }
              checkIdle()
            },
            onError: (error, packageName) => {
              failCount++
              const cachedStats = cachedPackageStats.get(packageName)

              if (cachedStats && cachedStats.downloads > 0) {
                fallbackCount++
                results.set(packageName, cachedStats)
                console.warn(
                  `[NPM Stats] Failed ${packageName}, using cached stats: ${error.message}`,
                )
              } else {
                uncachedFailures.push({
                  packageName,
                  error: error.message,
                })
                console.error(
                  `[NPM Stats] Failed ${packageName} with no cached stats: ${error.message}`,
                )
              }

              checkIdle()
            },
          },
        )

        // Add all packages to the queue
        packageNames.forEach((packageName) => queue.addItem(packageName))

        // Handle edge case where no packages to process
        if (packageNames.length === 0) {
          resolve()
        }
      })

      if (uncachedFailures.length > 0) {
        const failedPackageNames = uncachedFailures
          .slice(0, 10)
          .map((failure) => failure.packageName)
          .join(', ')
        const suffix =
          uncachedFailures.length > 10
            ? `, and ${uncachedFailures.length - 10} more`
            : ''

        throw new Error(
          `Failed to refresh ${uncachedFailures.length} npm packages with no cached fallback: ${failedPackageNames}${suffix}`,
        )
      }

      if (fallbackCount > 0) {
        console.warn(
          `[NPM Stats] Used cached fallback stats for ${fallbackCount} packages`,
        )
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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      retries--

      if (retries > 0) {
        const waitTime = Math.pow(2, 4 - retries) * 1000
        console.warn(
          `[NPM Stats] Error fetching org stats for ${org}, retrying in ${waitTime}ms...`,
          lastError.message,
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      } else {
        console.error(
          `[NPM Stats] Error fetching org stats for ${org} after all retries:`,
          lastError.message,
        )
        throw lastError
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch org stats for ${org}`)
}

/**
 * Refresh NPM organization statistics (force recompute and update cache)
 * Used by scheduled jobs or manual triggers
 * Also discovers and registers all packages before computing stats
 * Uses cached immutable chunks by default, or bypasses chunk cache when
 * forceRefresh is enabled for admin repair operations.
 */
export async function refreshNpmOrgStats(
  org: string,
  options: FetchNpmPackageDownloadsOptions = {},
): Promise<NpmStats> {
  // Import db functions dynamically to avoid pulling server code into client bundle
  const {
    discoverAndRegisterPackages,
    setCachedNpmOrgStats,
    rebuildOssStatsCache,
  } = await import('./stats-db.server')

  // First, discover and register all packages
  try {
    await discoverAndRegisterPackages(org)
  } catch (error) {
    console.error(
      '[NPM Org Stats] Package discovery failed, continuing with stats refresh:',
      error instanceof Error ? error.message : String(error),
    )
  }

  const stats = await computeNpmOrgStats(org, options)
  await setCachedNpmOrgStats(org, stats)

  // Rebuild library caches after full refresh
  const { rebuildLibraryCaches } = await import('./stats-db.server')
  await rebuildLibraryCaches()
  await rebuildOssStatsCache(org)

  return stats
}

/**
 * Refresh GitHub organization statistics
 * Fetches and caches GitHub stats for the org and all library repos
 */
export async function refreshGitHubOrgStats(org: string): Promise<{
  orgStats: GitHubStats
  libraryResults: Array<{ repo: string; stars: number }>
  libraryErrors: Array<{ repo: string; error: string }>
}> {
  const { setCachedGitHubStats, rebuildOssStatsCache } =
    await import('./stats-db.server')

  // Refresh GitHub org stats
  console.log('[GitHub Stats] Refreshing GitHub org stats...')
  const githubCacheKey = `org:${org}`
  const githubStats = await fetchGitHubOwnerStats(org)
  await setCachedGitHubStats(githubCacheKey, githubStats, 1)

  // Refresh GitHub stats for each library repo
  console.log(
    '[GitHub Stats] Refreshing GitHub stats for individual libraries...',
  )
  const { libraries } = await import('~/libraries')
  console.log(
    `[GitHub Stats] Found ${libraries.length} libraries to process:`,
    libraries.map((lib) => ({ id: lib.id, repo: lib.repo })),
  )
  const libraryResults = []
  const libraryErrors = []

  for (let i = 0; i < libraries.length; i++) {
    const library = libraries[i]
    if (!library.repo) {
      console.log(`[GitHub Stats] Skipping library ${library.id} - no repo`)
      continue
    }

    console.log(
      `[GitHub Stats] Processing library ${library.id} (${library.repo})...`,
    )
    try {
      const repoStats = await fetchGitHubRepoStats(library.repo)
      console.log(
        `[GitHub Stats] Fetched stats for ${library.repo}: ${repoStats.starCount} stars`,
      )
      await setCachedGitHubStats(library.repo, repoStats, 1)
      console.log(
        `[GitHub Stats] ✓ Successfully cached stats for ${library.repo}`,
      )
      libraryResults.push({
        repo: library.repo,
        stars: repoStats.starCount,
      })

      // Add delay between requests to avoid rate limiting (except for last item)
      if (i < libraries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(
        `[GitHub Stats] Failed to refresh ${library.repo}:`,
        errorMessage,
      )
      libraryErrors.push({
        repo: library.repo,
        error: errorMessage,
      })
    }
  }

  await rebuildOssStatsCache(org)

  return {
    orgStats: githubStats,
    libraryResults,
    libraryErrors,
  }
}
