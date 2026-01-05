import { syncGitHubReleases } from './github'
import { syncBlogPosts } from './blog'

type SyncResult = {
  success: boolean
  results: {
    github: { success: boolean; error: string | null; syncedCount?: number }
    blog: { success: boolean; error: string | null }
  }
}

/**
 * Master sync function that syncs all sources
 * Can be called manually from admin UI or via scheduled function
 */
export async function syncAllSources(): Promise<SyncResult> {
  const results: {
    github: { success: boolean; error: string | null; syncedCount?: number }
    blog: { success: boolean; error: string | null }
  } = {
    github: { success: false, error: null },
    blog: { success: false, error: null },
  }

  // Sync GitHub releases (last 48 hours / 2 days)
  try {
    const githubResult = await syncGitHubReleases({ daysBack: 2 })
    results.github.success = githubResult.success
    results.github.syncedCount = githubResult.syncedCount
  } catch (error) {
    results.github.error =
      error instanceof Error ? error.message : 'Unknown error'
  }

  // Sync blog posts from content collections
  try {
    const blogResult = await syncBlogPosts()
    results.blog.success = blogResult.success
  } catch (error) {
    results.blog.error =
      error instanceof Error ? error.message : 'Unknown error'
  }

  return {
    success: results.github.success && results.blog.success,
    results,
  }
}
