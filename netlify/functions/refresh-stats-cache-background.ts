import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import {
  refreshNpmOrgStats,
  fetchGitHubOwnerStats,
  fetchGitHubRepoStats,
} from '~/utils/stats.functions'
import { setCachedGitHubStats } from '~/utils/stats-db.server'

/**
 * Netlify Background + Scheduled Function - Refresh org-level stats cache
 *
 * This function combines both background and scheduled execution:
 * - Can be invoked via HTTP POST (returns 202 immediately, runs in background)
 * - Can be triggered on a schedule (runs automatically via cron)
 *
 * Background functions have a 15-minute timeout (vs 30 seconds for regular functions)
 * and return a 202 response immediately while processing continues in the background.
 *
 * This function refreshes pre-aggregated stats for the TanStack organization:
 * - GitHub: stars, contributors, dependents
 * - NPM: total downloads across all packages (including legacy packages)
 *
 * Scheduled: Runs automatically every 6 hours (configured via export config)
 * Only called by Netlify's scheduler - not publicly accessible
 * Timeout: 15 minutes
 * Concurrency: 8 packages at a time, 500ms delay between packages
 *
 * Performance Impact:
 * - Refresh time: ~10-20 minutes for 203 packages (199 scoped + 4 legacy)
 * - After refresh: ~100-200ms per request (served from cache)
 */
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  console.log('[refresh-stats-cache-background] Starting stats refresh...')

  const startTime = Date.now()

  try {
    const org = 'tanstack'

    // Refresh NPM org stats (fetches all packages, aggregates, and caches)
    console.log('[refresh-stats-cache-background] Refreshing NPM org stats...')
    const npmStats = await refreshNpmOrgStats(org)

    // Refresh GitHub org stats
    console.log(
      '[refresh-stats-cache-background] Refreshing GitHub org stats...',
    )
    const githubCacheKey = `org:${org}`
    const githubStats = await fetchGitHubOwnerStats(org)
    await setCachedGitHubStats(githubCacheKey, githubStats, 1)

    // Refresh GitHub stats for each library repo
    console.log(
      '[refresh-stats-cache-background] Refreshing GitHub stats for individual libraries...',
    )
    const { libraries } = await import('~/libraries')
    console.log(
      `[refresh-stats-cache-background] Found ${libraries.length} libraries to process:`,
      libraries.map((lib) => ({ id: lib.id, repo: lib.repo })),
    )
    const libraryResults = []
    const libraryErrors = []

    for (let i = 0; i < libraries.length; i++) {
      const library = libraries[i]
      if (!library.repo) {
        console.log(
          `[refresh-stats-cache-background] Skipping library ${library.id} - no repo`,
        )
        continue
      }

      console.log(
        `[refresh-stats-cache-background] Processing library ${library.id} (${library.repo})...`,
      )
      try {
        const repoStats = await fetchGitHubRepoStats(library.repo)
        console.log(
          `[refresh-stats-cache-background] Fetched stats for ${
            library.repo
          }: ${repoStats.starCount} stars, ${
            repoStats.contributorCount
          } contributors, ${repoStats.dependentCount ?? 'N/A'} dependents`,
        )
        await setCachedGitHubStats(library.repo, repoStats, 1)
        console.log(
          `[refresh-stats-cache-background] ✓ Successfully cached stats for ${library.repo}`,
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
          `[refresh-stats-cache-background] Failed to refresh ${library.repo}:`,
          errorMessage,
        )
        libraryErrors.push({
          repo: library.repo,
          error: errorMessage,
        })
      }
    }

    const duration = Date.now() - startTime
    console.log(
      `[refresh-stats-cache-background] ✓ Completed in ${duration}ms - NPM: ${npmStats.totalDownloads.toLocaleString()} downloads (${
        Object.keys(npmStats.packageStats || {}).length
      } packages), GitHub Org: ${githubStats.starCount.toLocaleString()} stars, Libraries: ${
        libraryResults.length
      } refreshed, ${libraryErrors.length} failed`,
    )

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        duration,
        stats: {
          npm: {
            totalDownloads: npmStats.totalDownloads,
            packageCount: Object.keys(npmStats.packageStats || {}).length,
          },
          github: {
            org: {
              starCount: githubStats.starCount,
              contributorCount: githubStats.contributorCount,
              dependentCount: githubStats.dependentCount,
            },
            libraries: {
              refreshed: libraryResults.length,
              failed: libraryErrors.length,
              results: libraryResults,
              errors: libraryErrors,
            },
          },
        },
      }),
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(
      `[refresh-stats-cache-background] ✗ Failed after ${duration}ms:`,
      errorMessage,
    )
    if (errorStack) {
      console.error('[refresh-stats-cache-background] Stack:', errorStack)
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        duration,
        error: errorMessage,
        stack: errorStack,
      }),
    }
  }
}

/**
 * Netlify function configuration
 * - type: 'experimental-background' enables background execution (15 min timeout, returns 202 immediately)
 * - schedule: Cron expression for scheduled execution (runs every 6 hours)
 */
export const config = {
  type: 'experimental-background' as const,
  schedule: '0 */6 * * *', // Every 6 hours
}
