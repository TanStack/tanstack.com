import { action } from '../_generated/server'
import { api } from '../_generated/api'

type SyncResult = {
  success: boolean
  results: {
    github: { success: boolean; error: string | null }
    blog: { success: boolean; error: string | null }
  }
}

/**
 * Master sync function that syncs all sources
 * Can be called manually from admin UI
 */
export const syncAllSources = action({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    const results = {
      github: { success: false, error: null as string | null },
      blog: { success: false, error: null as string | null },
    }

    // Sync GitHub releases (last 48 hours / 2 days)
    try {
      const githubResult: { success: boolean } = await ctx.runAction(
        api.feed.github.syncGitHubReleases,
        {} // Uses default of 2 days
      )
      results.github.success = githubResult.success
    } catch (error) {
      results.github.error =
        error instanceof Error ? error.message : 'Unknown error'
    }

    // Note: Blog sync requires blog post data from server
    // This should be called via a server function that has access to content-collections
    // For now, we'll mark it as requiring manual trigger
    results.blog.error =
      'Blog sync requires server-side trigger with content-collections access'

    return {
      success: results.github.success,
      results,
    }
  },
})
