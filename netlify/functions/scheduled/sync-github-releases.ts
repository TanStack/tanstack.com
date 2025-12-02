import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { syncGitHubReleases } from '~/server/feed/github'

/**
 * Netlify Scheduled Function - Sync GitHub releases hourly
 *
 * Schedule: Every hour at minute 0
 * Configure in netlify.toml:
 *
 * [[functions]]
 *   directory = "netlify/functions"
 *
 * [[functions.scheduled]]
 *   cron = "0 * * * *"  # Every hour at minute 0
 *   function = "scheduled/sync-github-releases"
 */
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  try {
    console.log('[sync-github-releases] Starting GitHub release sync...')

    const result = await syncGitHubReleases()

    console.log('[sync-github-releases] Sync completed:', result)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'GitHub releases synced successfully',
        result,
      }),
    }
  } catch (error) {
    console.error('[sync-github-releases] Error:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
