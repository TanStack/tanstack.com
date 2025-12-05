import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { syncGitHubReleases } from '~/server/feed/github.functions'

/**
 * Netlify Background + Scheduled Function - Sync GitHub releases
 *
 * This function combines both background and scheduled execution:
 * - Can be invoked via HTTP POST (returns 202 immediately, runs in background)
 * - Can be triggered on a schedule (runs automatically via cron)
 *
 * Background functions have a 15-minute timeout (vs 30 seconds for regular functions)
 * and return a 202 response immediately while processing continues in the background.
 *
 * This function syncs GitHub releases from all TanStack repos:
 * - Fetches new releases since last sync
 * - Creates/updates feed items in the database
 * - Marks releases as synced to avoid duplicates
 *
 * Scheduled: Runs automatically every 6 hours (configured via export config)
 * Only called by Netlify's scheduler - not publicly accessible
 * Timeout: 15 minutes
 */
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  console.log(
    '[sync-github-releases-background] Starting GitHub release sync...',
  )

  const startTime = Date.now()

  try {
    const result = await syncGitHubReleases()

    const duration = Date.now() - startTime
    console.log(
      `[sync-github-releases-background] ✓ Completed in ${duration}ms - Synced: ${result.syncedCount}, Skipped: ${result.skippedCount}, Errors: ${result.errorCount}`,
    )

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        duration,
        result: {
          syncedCount: result.syncedCount,
          skippedCount: result.skippedCount,
          errorCount: result.errorCount,
        },
      }),
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(
      `[sync-github-releases-background] ✗ Failed after ${duration}ms:`,
      errorMessage,
    )
    if (errorStack) {
      console.error('[sync-github-releases-background] Stack:', errorStack)
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
