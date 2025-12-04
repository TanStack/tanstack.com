import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { refreshNpmOrgStats, fetchGitHubOwnerStats } from '~/utils/stats.functions'
import { setCachedGitHubStats } from '~/utils/stats-db.server'

/**
 * Netlify Background Function - Refresh org-level stats cache
 *
 * Background functions are identified by the `-background` suffix in the filename.
 * They have a 15-minute timeout (vs 30 seconds for regular functions) and return
 * a 202 response immediately while processing continues in the background.
 *
 * This function refreshes pre-aggregated stats for the TanStack organization:
 * - GitHub: stars, contributors, dependents
 * - NPM: total downloads across all packages (including legacy packages)
 *
 * Invocation:
 *   POST https://tanstack.com/.netlify/functions/refresh-stats-cache-background
 *   Authorization: Bearer YOUR_CRON_SECRET
 *
 * Can be triggered manually from the admin panel.
 * Timeout: 15 minutes
 * Concurrency: 8 packages at a time, 500ms delay between packages
 *
 * Performance Impact:
 * - Refresh time: ~10-20 minutes for 203 packages (199 scoped + 4 legacy)
 * - After refresh: ~100-200ms per request (served from cache)
 */
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  console.log('[refresh-stats-cache-background] Starting background stats refresh...')

  // Check authentication
  const cronSecret = process.env.CRON_SECRET
  const authHeader = event.headers.authorization || event.headers.Authorization

  if (!cronSecret) {
    console.error('[refresh-stats-cache-background] CRON_SECRET not configured')
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'CRON_SECRET not configured',
      }),
    }
  }

  // Extract token from "Bearer TOKEN" format
  const providedSecret = authHeader?.replace(/^Bearer\s+/i, '')

  if (providedSecret !== cronSecret) {
    console.error('[refresh-stats-cache-background] Invalid authentication')
    return {
      statusCode: 401,
      body: JSON.stringify({
        error: 'Invalid authentication',
      }),
    }
  }

  const startTime = Date.now()

  try {
    const org = 'tanstack'

    // Refresh NPM org stats (fetches all packages, aggregates, and caches)
    console.log('[refresh-stats-cache-background] Refreshing NPM org stats...')
    const npmStats = await refreshNpmOrgStats(org)

    // Refresh GitHub org stats
    console.log('[refresh-stats-cache-background] Refreshing GitHub org stats...')
    const githubCacheKey = `org:${org}`
    const githubStats = await fetchGitHubOwnerStats(org)
    await setCachedGitHubStats(githubCacheKey, githubStats, 1)

    const duration = Date.now() - startTime
    console.log(
      `[refresh-stats-cache-background] ✓ Completed in ${duration}ms - NPM: ${npmStats.totalDownloads.toLocaleString()} downloads (${
        Object.keys(npmStats.packageStats || {}).length
      } packages), GitHub: ${githubStats.starCount.toLocaleString()} stars`
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
            starCount: githubStats.starCount,
            contributorCount: githubStats.contributorCount,
            dependentCount: githubStats.dependentCount,
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
      errorMessage
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
