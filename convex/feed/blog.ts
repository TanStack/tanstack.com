import { action } from '../_generated/server'
import { v } from 'convex/values'
import { api } from '../_generated/api'

/**
 * Normalize blog post to feed entry format
 */
export function normalizeBlogPost(post: {
  slug: string
  title: string
  published: string
  excerpt?: string
  content: string
  authors: string[]
}): {
  id: string
  source: string
  title: string
  content: string
  excerpt?: string
  publishedAt: number
  metadata: any
  libraryIds: string[]
  partnerIds?: string[]
  tags: string[]
  category: 'blog'
  isVisible: boolean
  featured?: boolean
  autoSynced: boolean
} {
  const id = `blog:${post.slug}`
  const publishedAt = new Date(post.published).getTime()

  return {
    id,
    source: 'blog',
    title: post.title,
    content: post.content,
    excerpt: post.excerpt,
    publishedAt,
    metadata: {
      slug: post.slug,
      url: `/blog/${post.slug}`,
      authors: post.authors,
    },
    libraryIds: [], // Blog posts aren't tied to specific libraries by default
    tags: ['source:blog', 'category:blog'],
    category: 'blog',
    isVisible: true,
    autoSynced: true,
  }
}

/**
 * Sync blog posts from content-collections
 * This action should be called with blog post data from the server
 */
export const syncBlogPosts = action({
  args: {
    posts: v.array(
      v.object({
        slug: v.string(),
        title: v.string(),
        published: v.string(),
        excerpt: v.optional(v.string()),
        content: v.string(),
        authors: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    let syncedCount = 0
    let errorCount = 0

    for (const post of args.posts) {
      try {
        const normalized = normalizeBlogPost(post)

        // Check if entry already exists
        const existing = await ctx.runQuery(api.feed.queries.getFeedEntry, {
          id: normalized.id,
        })

        if (existing) {
          // Update existing entry
          // Don't update publishedAt for auto-synced entries - preserve original publication date
          await ctx.runMutation(api.feed.mutations.updateFeedEntry, {
            id: normalized.id,
            title: normalized.title,
            content: normalized.content,
            excerpt: normalized.excerpt,
            // Only update publishedAt if entry was manually created
            // For auto-synced entries, preserve the original publishedAt
            publishedAt: existing.autoSynced
              ? undefined
              : normalized.publishedAt,
            metadata: normalized.metadata,
            libraryIds: normalized.libraryIds,
            tags: normalized.tags,
            lastSyncedAt: now,
          })
        } else {
          // Create new entry
          await ctx.runMutation(api.feed.mutations.createFeedEntry, {
            ...normalized,
          })
        }

        syncedCount++
      } catch (error) {
        console.error(`Error processing blog post ${post.slug}:`, error)
        errorCount++
      }
    }

    return {
      success: true,
      syncedCount,
      errorCount,
      totalPosts: args.posts.length,
    }
  },
})
