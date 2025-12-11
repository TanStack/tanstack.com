import { syncGitHubReleases } from './github'
// TODO: Add blog sync when implemented
// import { syncBlogPosts } from './blog'

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
  const results = {
    github: { success: false, error: null as string | null },
    blog: { success: false, error: null as string | null },
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

  // Note: Blog sync requires blog post data from server
  // This should be called via a server function that has access to content-collections
  results.blog.error =
    'Blog sync requires server-side trigger with content-collections access'

  return {
    success: results.github.success,
    results,
  }
}
