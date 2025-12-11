import type { Config } from '@netlify/functions'
import { refreshGitHubOrgStats } from '~/utils/stats.functions'

/**
 * Netlify Scheduled Function - Refresh GitHub stats cache
 *
 * This function refreshes pre-aggregated GitHub stats for the TanStack organization:
 * - Organization-level: stars, contributors, dependents, repositories
 * - Per-library: stars, contributors, dependents for each library repo
 *
 * Scheduled: Runs automatically every 6 hours
 *
 * Performance Impact:
 * - Refresh time: ~1-2 minutes for org + all library repos
 * - After refresh: ~100-200ms per request (served from cache)
 */
const handler = async (req: Request) => {
  const { next_run } = await req.json()

  console.log('[refresh-github-stats] Starting GitHub stats refresh...')

  const startTime = Date.now()

  try {
    const org = 'tanstack'

    const { orgStats, libraryResults, libraryErrors } =
      await refreshGitHubOrgStats(org)

    const duration = Date.now() - startTime
    console.log(
      `[refresh-github-stats] ✓ Completed in ${duration}ms - GitHub Org: ${orgStats.starCount.toLocaleString()} stars, Libraries: ${
        libraryResults.length
      } refreshed, ${libraryErrors.length} failed`,
    )
    console.log('[refresh-github-stats] Next invocation at:', next_run)
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(
      `[refresh-github-stats] ✗ Failed after ${duration}ms:`,
      errorMessage,
    )
    if (errorStack) {
      console.error('[refresh-github-stats] Stack:', errorStack)
    }
  }
}

export default handler

export const config: Config = {
  schedule: '0 */6 * * *', // Every 6 hours
}
