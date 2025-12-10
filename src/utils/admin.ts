import { createServerFn } from '@tanstack/react-start'
import { requireCapability } from './auth.server'
import { syncAllSources } from '~/server/feed/sync-all'
import { syncGitHubReleases } from '~/server/feed/github'
import { syncBlogPosts } from '~/server/feed/blog'

// Server function to sync all feed sources (admin only)
export const syncAllFeedSources = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })
    return await syncAllSources()
  },
)

// Server function to sync GitHub releases only (admin only)
export const syncGitHubSource = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })
    const result = await syncGitHubReleases()
    return {
      success: result.success,
      syncedCount: result.syncedCount,
      errorCount: result.errorCount,
      skippedCount: result.skippedCount,
    }
  },
)

// Server function to sync blog posts only (admin only)
export const syncBlogSource = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })
    return await syncBlogPosts()
  },
)
