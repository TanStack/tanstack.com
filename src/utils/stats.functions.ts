/**
 * Pure stats functions that can be used by both TanStack Start server functions
 * and Netlify functions. No TanStack Start dependencies.
 */

import * as cheerio from 'cheerio'
import { envFunctions } from './env.functions'
import type { GitHubStats, NpmPackageStats, NpmStats } from './stats.server'

/**
 * Parse number from string, removing commas
 */
function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = parseInt(value.replace(/,/g, ''), 10)
  return isNaN(parsed) ? undefined : parsed
}

/**
 * Scrape GitHub repository page for dependent count
 * Uses retry logic as scraping can be unreliable
 */
async function scrapeGitHubDependentCount(
  repo: string,
  maxRetries: number = 3,
): Promise<number | undefined> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`https://github.com/${repo}`, {
        headers: {
          'User-Agent': 'TanStack-Stats',
          Accept: 'text/html',
        },
      })

      if (!response.ok) {
        console.warn(
          `[GitHub Scraper] Failed to fetch ${repo} page (${response.status}), attempt ${attempt}/${maxRetries}`,
        )
        continue
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Find the dependents link and extract the count from the Counter span
      // Selector: a[href$="/network/dependents"] > span.Counter
      const dependentCount = $(`a[href$="/network/dependents"] > span.Counter`)
        .filter((_, el) => {
          const title = $(el).attr('title')
          return !!parseNumber(title)
        })
        .attr('title')

      const parsedCount = parseNumber(dependentCount)

      if (parsedCount !== undefined) {
        return parsedCount
      }

      console.warn(
        `[GitHub Scraper] No dependent count found for ${repo}, attempt ${attempt}/${maxRetries}`,
      )
    } catch (error) {
      console.error(
        `[GitHub Scraper] Error scraping ${repo}, attempt ${attempt}/${maxRetries}:`,
        error instanceof Error ? error.message : String(error),
      )
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const waitTime = Math.pow(2, attempt) * 1000
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
  }

  console.warn(
    `[GitHub Scraper] Failed to scrape dependent count for ${repo} after ${maxRetries} attempts`,
  )
  return undefined
}

/**
 * Scrape GitHub repository page for contributor count
 * Uses retry logic as scraping can be unreliable
 */
async function scrapeGitHubContributorCount(
  repo: string,
  maxRetries: number = 3,
): Promise<number | undefined> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`https://github.com/${repo}`, {
        headers: {
          'User-Agent': 'TanStack-Stats',
          Accept: 'text/html',
        },
      })

      if (!response.ok) {
        console.warn(
          `[GitHub Scraper] Failed to fetch ${repo} page (${response.status}), attempt ${attempt}/${maxRetries}`,
        )
        continue
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Find the contributors link and extract the count from the Counter span
      // Selector: a[href$="/graphs/contributors"] > span.Counter
      const contributorCount = $(
        `a[href$="/graphs/contributors"] > span.Counter`,
      )
        .filter((_, el) => {
          const title = $(el).attr('title')
          return !!parseNumber(title)
        })
        .attr('title')

      const parsedCount = parseNumber(contributorCount)

      if (parsedCount !== undefined) {
        return parsedCount
      }

      console.warn(
        `[GitHub Scraper] No contributor count found for ${repo}, attempt ${attempt}/${maxRetries}`,
      )
    } catch (error) {
      console.error(
        `[GitHub Scraper] Error scraping ${repo}, attempt ${attempt}/${maxRetries}:`,
        error instanceof Error ? error.message : String(error),
      )
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const waitTime = Math.pow(2, attempt) * 1000
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
  }

  console.warn(
    `[GitHub Scraper] Failed to scrape contributor count for ${repo} after ${maxRetries} attempts`,
  )
  return undefined
}

/**
 * Fetch GitHub repository statistics
 */
export async function fetchGitHubRepoStats(repo: string): Promise<GitHubStats> {
  const token = envFunctions.GITHUB_AUTH_TOKEN
  if (!token || token === 'USE_A_REAL_KEY_IN_PRODUCTION') {
    throw new Error('GITHUB_AUTH_TOKEN not configured')
  }

  const [repoData, contributorCount, dependentCount] = await Promise.all([
    // Get repo basic stats
    fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'TanStack-Stats',
      },
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
    }),

    // Scrape contributor count from GitHub web UI
    // Using scraping instead of API to get the full count without pagination limits
    // Wrap in catch to ensure it never rejects - scraping failures shouldn't break the whole operation
    scrapeGitHubContributorCount(repo).catch((error) => {
      console.error(
        `[GitHub Stats] Contributor count scraping failed for ${repo}:`,
        error instanceof Error ? error.message : String(error),
      )
      return undefined
    }),

    // Scrape dependent count from GitHub web UI
    // GitHub doesn't provide this via REST or GraphQL API
    // Wrap in catch to ensure it never rejects - scraping failures shouldn't break the whole operation
    scrapeGitHubDependentCount(repo).catch((error) => {
      console.error(
        `[GitHub Stats] Dependent count scraping failed for ${repo}:`,
        error instanceof Error ? error.message : String(error),
      )
      return undefined
    }),
  ])

  return {
    starCount: repoData.stargazers_count ?? 0,
    contributorCount: contributorCount ?? 0,
    dependentCount: dependentCount,
    forkCount: repoData.forks_count ?? 0,
  }
}

/**
 * Fetch GitHub organization statistics (aggregate across all repos)
 */
export async function fetchGitHubOwnerStats(
  owner: string,
): Promise<GitHubStats> {
  const token = envFunctions.GITHUB_AUTH_TOKEN
  if (!token || token === 'USE_A_REAL_KEY_IN_PRODUCTION') {
    throw new Error('GITHUB_AUTH_TOKEN not configured')
  }

  // Fetch all repos for the organization
  const repos: any[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await fetch(
      `https://api.github.com/orgs/${owner}/repos?per_page=100&page=${page}&sort=stars`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'TanStack-Stats',
        },
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

  const repositoryCount = repos.length

  // Scrape contributor and dependent counts from each repo's page
  // Note: This sums counts across repos, which may count the same person multiple times
  // if they contributed to multiple repos. This provides higher numbers than trying to deduplicate via API calls.
  const repoStats = await Promise.all(
    repos.map(async (repo) => {
      try {
        const [contributorCount, dependentCount] = await Promise.all([
          // Wrap in catch to ensure scraping failures don't break the operation
          scrapeGitHubContributorCount(repo.full_name).catch((error) => {
            console.error(
              `[GitHub Stats] Contributor count scraping failed for ${repo.full_name}:`,
              error instanceof Error ? error.message : String(error),
            )
            return undefined
          }),
          scrapeGitHubDependentCount(repo.full_name).catch((error) => {
            console.error(
              `[GitHub Stats] Dependent count scraping failed for ${repo.full_name}:`,
              error instanceof Error ? error.message : String(error),
            )
            return undefined
          }),
        ])
        return {
          contributorCount: contributorCount ?? 0,
          dependentCount: dependentCount ?? 0,
        }
      } catch (error) {
        console.error(
          `[GitHub Stats] Failed to scrape stats for ${repo.full_name}:`,
          error instanceof Error ? error.message : String(error),
        )
        return {
          contributorCount: 0,
          dependentCount: 0,
        }
      }
    }),
  )

  const totalContributorCount = repoStats.reduce(
    (sum, stats) => sum + stats.contributorCount,
    0,
  )

  const totalDependentCount = repoStats.reduce(
    (sum, stats) => sum + stats.dependentCount,
    0,
  )

  return {
    starCount,
    contributorCount: totalContributorCount,
    dependentCount: totalDependentCount,
    forkCount,
    repositoryCount,
  }
}

/**
 * Fetch package creation date from npm registry
 */
async function fetchNpmPackageCreationDate(
  packageName: string,
): Promise<string> {
  try {
    const response = await fetch(`https://registry.npmjs.com/${packageName}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TanStack-Stats',
      },
    })

    if (!response.ok) {
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
 * Normalize date ranges into consistent chunk boundaries
 * Uses fixed 500-day chunks aligned to calendar dates for cache consistency
 *
 * This ensures the same date ranges are used across all fetches, preventing
 * duplicate cache entries with different keys (e.g., 2025-12-06 vs 2025-12-07)
 */
function generateNormalizedChunks(
  startDate: string,
  endDate: string,
): Array<{ from: string; to: string }> {
  const CHUNK_DAYS = 500 // Stay well under 18-month (549 day) limit
  const chunks: Array<{ from: string; to: string }> = []

  let currentFrom = new Date(startDate)
  const finalDate = new Date(endDate)

  while (currentFrom <= finalDate) {
    const from = currentFrom.toISOString().substring(0, 10)

    // Calculate chunk end: either CHUNK_DAYS later or finalDate, whichever is earlier
    const potentialTo = new Date(currentFrom)
    potentialTo.setDate(potentialTo.getDate() + CHUNK_DAYS - 1) // -1 because inclusive

    const to =
      potentialTo > finalDate
        ? finalDate.toISOString().substring(0, 10)
        : potentialTo.toISOString().substring(0, 10)

    chunks.push({ from, to })

    // Move to next chunk (day after current chunk ends)
    currentFrom = new Date(to)
    currentFrom.setDate(currentFrom.getDate() + 1)

    // Prevent infinite loop if we've reached the end
    if (to === endDate) break
  }

  return chunks
}

/**
 * Fetch all-time download counts using chunked /range/ requests
 * This is the correct method as npm API limits /point/ to 18 months
 *
 * Uses normalized chunk boundaries for consistent caching across runs
 * Fetches chunks sequentially (concurrency controlled at package level)
 * Returns total downloads and daily rate (average from last full week)
 */
async function fetchNpmPackageDownloadsChunked(
  packageName: string,
  createdDate: string,
): Promise<{ totalDownloads: number; ratePerDay: number }> {
  const today = new Date().toISOString().substring(0, 10)

  // Generate normalized chunks for consistent cache keys
  const chunks = generateNormalizedChunks(createdDate, today)

  let totalDownloadCount = 0
  let lastChunkData: { day: string; downloads: number }[] = []

  // Load cache functions (dynamic import for Netlify compatibility)
  const { getCachedNpmDownloadChunk, setCachedNpmDownloadChunk } =
    await import('./stats-db.server')

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

    if (cachedChunk) {
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
          `https://api.npmjs.org/downloads/range/${chunk.from}:${chunk.to}/${packageName}`,
          {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'TanStack-Stats',
            },
          },
        )

        if (!response.ok) {
          if (response.status === 404) {
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

        const pageData: {
          end: string
          downloads: { day: string; downloads: number }[]
          error?: string
        } = await response.json()

        if (pageData.error === `package ${packageName} not found`) {
          success = true // Exit retry loop
          continue
        }

        const downloadCount = pageData.downloads.reduce(
          (acc, cur) => acc + cur.downloads,
          0,
        )

        totalDownloadCount += downloadCount
        if (pageData.downloads.length > 0) {
          lastChunkData = pageData.downloads
        }

        // Cache the fetched chunk for future use (best-effort)
        try {
          await setCachedNpmDownloadChunk({
            packageName,
            dateFrom: chunk.from,
            dateTo: chunk.to,
            binSize: 'daily',
            totalDownloads: downloadCount,
            dailyData: pageData.downloads,
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
        return { downloads: 0 }
      }
    }
  }

  return { downloads: 0 }
}

/**
 * Compute NPM organization statistics (expensive operation)
 * Fetches all packages and aggregates their stats
 * Always bypasses cache to ensure fresh data from NPM API
 */
export async function computeNpmOrgStats(org: string): Promise<NpmStats> {
  // Fetch all packages in the org
  let retries = 3
  let lastError: Error | null = null

  while (retries > 0) {
    try {
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
        if (response.status === 429) {
          // Note: NPM's Retry-After header is unreliable (often returns "0")
          // Use fixed 5 second wait time instead
          const waitTime = 5000 // 5 seconds

          console.warn(
            `[NPM Stats] Rate limited fetching org packages, waiting ${waitTime}ms before retry (attempt ${
              4 - retries
            }/3)...`,
          )

          if (retries > 1) {
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            retries--
            continue
          } else {
            throw new Error(`NPM API rate limited: ${response.status}`)
          }
        }

        throw new Error(`NPM API error: ${response.status}`)
      }

      const data = await response.json()
      let packageNames = Object.keys(data)

      if (packageNames.length === 0) {
        console.error(`[NPM Stats] No packages found for org ${org}`)
        return { totalDownloads: 0, packageStats: {} }
      }

      // Add legacy (non-scoped) packages from library definitions
      // The org endpoint only returns @tanstack/* scoped packages
      const { libraries } = await import('~/libraries')
      const legacyPackages: string[] = []
      for (const library of libraries) {
        if (library.legacyPackages) {
          legacyPackages.push(...library.legacyPackages)
        }
      }

      if (legacyPackages.length > 0) {
        packageNames = [...packageNames, ...legacyPackages]
      }

      // Fetch fresh data for all packages (always bypassing cache)
      const results = new Map<string, NpmPackageStats>()

      // Fetch packages using single AsyncQueuer (chunks are sequential within each package)
      const { AsyncQueuer } = await import('@tanstack/pacer')
      let successCount = 0
      let failCount = 0

      await new Promise<void>((resolve, reject) => {
        const queue = new AsyncQueuer(
          async (packageName: string) => {
            const stats = await fetchSingleNpmPackageFresh(packageName, 3)
            return stats
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
            },
            onError: (error, packageName) => {
              failCount++
              console.error(
                `[NPM Stats] Failed ${packageName}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              )
              // Store 0 for failed packages
              const zeroStats = { downloads: 0 }
              results.set(packageName, zeroStats)
            },
            onIdle: () => {
              console.log(
                `[NPM Stats] Completed: ${successCount} successful, ${failCount} failed`,
              )
              resolve()
            },
          },
        )

        // Add all packages to the queue
        packageNames.forEach((packageName) => queue.addItem(packageName))
      })

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
        return { totalDownloads: 0, packageStats: {} }
      }
    }
  }

  return { totalDownloads: 0, packageStats: {} }
}

/**
 * Refresh NPM organization statistics (force recompute and update cache)
 * Used by scheduled jobs or manual triggers
 * Also discovers and registers all packages before computing stats
 * Always bypasses cache to ensure fresh data
 */
export async function refreshNpmOrgStats(org: string): Promise<NpmStats> {
  // Import db functions dynamically to avoid pulling server code into client bundle
  const { discoverAndRegisterPackages, setCachedNpmOrgStats } =
    await import('./stats-db.server')

  // First, discover and register all packages
  try {
    await discoverAndRegisterPackages(org)
  } catch (error) {
    console.error(
      '[NPM Org Stats] Package discovery failed, continuing with stats refresh:',
      error instanceof Error ? error.message : String(error),
    )
  }

  const stats = await computeNpmOrgStats(org)
  await setCachedNpmOrgStats(org, stats)

  // Rebuild library caches after full refresh
  const { rebuildLibraryCaches } = await import('./stats-db.server')
  await rebuildLibraryCaches()

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
  const { setCachedGitHubStats } = await import('./stats-db.server')

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
        `[GitHub Stats] Fetched stats for ${library.repo}: ${
          repoStats.starCount
        } stars, ${repoStats.contributorCount} contributors, ${
          repoStats.dependentCount ?? 'N/A'
        } dependents`,
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

  return {
    orgStats: githubStats,
    libraryResults,
    libraryErrors,
  }
}
