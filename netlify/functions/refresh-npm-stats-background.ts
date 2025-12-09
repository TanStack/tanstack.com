import type { Config } from '@netlify/functions'
import { refreshNpmOrgStats } from '~/utils/stats.functions'

/**
 * Netlify Scheduled Function - Refresh NPM stats cache
 *
 * This function refreshes pre-aggregated NPM stats for the TanStack organization:
 * - Total downloads across all packages (including legacy packages)
 * - Per-package download counts and rates
 *
 * Scheduled: Runs automatically every 6 hours
 * Concurrency: 8 packages at a time, 500ms delay between packages
 *
 * Performance Impact:
 * - Refresh time: ~10-20 minutes for 203 packages (199 scoped + 4 legacy)
 * - After refresh: ~100-200ms per request (served from cache)
 */
const handler = async (req: Request) => {
  const { next_run } = await req.json()

  console.log('[refresh-npm-stats] Starting NPM stats refresh...')

  const startTime = Date.now()

  try {
    const org = 'tanstack'

    // Refresh NPM org stats (fetches all packages, aggregates, and caches)
    console.log('[refresh-npm-stats] Refreshing NPM org stats...')
    const npmStats = await refreshNpmOrgStats(org)

    const duration = Date.now() - startTime
    console.log(
      `[refresh-npm-stats] ✓ Completed in ${duration}ms - NPM: ${npmStats.totalDownloads.toLocaleString()} downloads (${
        Object.keys(npmStats.packageStats || {}).length
      } packages)`,
    )
    console.log('[refresh-npm-stats] Next invocation at:', next_run)
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(
      `[refresh-npm-stats] ✗ Failed after ${duration}ms:`,
      errorMessage,
    )
    if (errorStack) {
      console.error('[refresh-npm-stats] Stack:', errorStack)
    }
  }
}

export default handler

export const config: Config = {
  schedule: '0 */6 * * *', // Every 6 hours
}
