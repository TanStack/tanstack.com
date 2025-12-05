import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { syncGitHubReleases } from '~/server/feed/github.functions'

/**
 * Netlify Background Function - Sync GitHub releases
 *
 * Background functions are identified by the `-background` suffix in the filename.
 * They have a 15-minute timeout (vs 30 seconds for regular functions) and return
 * a 202 response immediately while processing continues in the background.
 *
 * This function syncs GitHub releases from all TanStack repos:
 * - Fetches new releases since last sync
 * - Creates/updates feed items in the database
 * - Marks releases as synced to avoid duplicates
 *
 * Invocation:
 *   POST https://tanstack.com/.netlify/functions/sync-github-releases-background
 *   Authorization: Bearer YOUR_CRON_SECRET
 *
 * Triggered by: .github/workflows/sync-github-releases.yml (hourly cron)
 * Timeout: 15 minutes
 */
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  console.log(
    '[sync-github-releases-background] Starting GitHub release sync...'
  )

  // Check authentication
  const cronSecret = process.env.CRON_SECRET
  const authHeader = event.headers.authorization || event.headers.Authorization

  if (!cronSecret) {
    console.error(
      '[sync-github-releases-background] CRON_SECRET not configured'
    )
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
    console.error('[sync-github-releases-background] Invalid authentication')
    return {
      statusCode: 401,
      body: JSON.stringify({
        error: 'Invalid authentication',
      }),
    }
  }

  const startTime = Date.now()

  try {
    const result = await syncGitHubReleases()

    const duration = Date.now() - startTime
    console.log(
      `[sync-github-releases-background] ✓ Completed in ${duration}ms - Synced: ${result.syncedCount}, Skipped: ${result.skippedCount}, Errors: ${result.errorCount}`
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
      errorMessage
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
