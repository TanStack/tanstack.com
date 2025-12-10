import type { Config } from '@netlify/functions'
import { syncBlogPosts } from '~/server/feed/blog'

/**
 * Netlify Scheduled Function - Sync blog posts from content collections
 *
 * This function syncs blog posts from content collections into the feed database:
 * - Reads all posts from content-collections (available in deployed server)
 * - Creates/updates feed entries with excerpt and link to full post
 * - Marks entries as auto-synced
 *
 * Scheduled: Runs automatically every 5 minutes to pick up new blog posts after deployment
 * Since the sync is idempotent, running frequently is safe.
 */
const handler = async (req: Request) => {
  const { next_run } = await req.json()

  console.log('[sync-blog-posts-background] Starting blog posts sync...')

  const startTime = Date.now()

  try {
    const result = await syncBlogPosts()

    const duration = Date.now() - startTime
    console.log(
      `[sync-blog-posts-background] ✓ Completed in ${duration}ms - Created: ${result.created}, Updated: ${result.updated}, Total: ${result.syncedCount}`,
    )
    if (result.errors.length > 0) {
      console.error(
        `[sync-blog-posts-background] Errors: ${result.errors.length}`,
        result.errors,
      )
    }
    console.log('[sync-blog-posts-background] Next invocation at:', next_run)
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(
      `[sync-blog-posts-background] ✗ Failed after ${duration}ms:`,
      errorMessage,
    )
    if (errorStack) {
      console.error('[sync-blog-posts-background] Stack:', errorStack)
    }
  }
}

export default handler

export const config: Config = {
  schedule: '*/5 * * * *', // Every 5 minutes
}
