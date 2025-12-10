/**
 * Pure blog sync functions that can be used by both TanStack Start server functions
 * and Netlify functions. No TanStack Start dependencies.
 */

import { db } from '~/db/client'
import { feedEntries } from '~/db/schema'
import { eq } from 'drizzle-orm'

export type BlogSyncResult = {
  success: boolean
  syncedCount: number
  created: number
  updated: number
  errors: string[]
}

/**
 * Syncs all blog posts from content collections into the feed database.
 * This should be called from the deployed server environment where content-collections
 * are available.
 */
export async function syncBlogPosts(): Promise<BlogSyncResult> {
  // Dynamic import to ensure content-collections are available in server environment
  const { allPosts } = await import('content-collections')

  const results: BlogSyncResult = {
    success: true,
    syncedCount: 0,
    created: 0,
    updated: 0,
    errors: [],
  }

  for (const post of allPosts) {
    try {
      const entryId = `blog:${post.slug}`
      const publishedAt = new Date(post.published)

      // Check if entry already exists
      const existing = await db.query.feedEntries.findFirst({
        where: eq(feedEntries.entryId, entryId),
      })

      // Build content with excerpt and link to full post
      const excerpt = post.excerpt || post.description || ''
      const blogUrl = `/blog/${post.slug}`
      const content = excerpt
        ? `${excerpt}\n\n[Read more →](${blogUrl})`
        : `[Read more →](${blogUrl})`

      const entryData = {
        entryId,
        source: 'blog',
        title: post.title,
        content,
        excerpt: post.excerpt || post.description || null,
        publishedAt,
        category: 'blog' as const,
        isVisible: true,
        autoSynced: true,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
        libraryIds: [],
        partnerIds: [],
        tags: [],
        metadata: {
          slug: post.slug,
          authors: post.authors,
          headerImage: post.headerImage,
          url: blogUrl,
        },
      }

      if (existing) {
        // Update existing entry
        await db
          .update(feedEntries)
          .set(entryData)
          .where(eq(feedEntries.entryId, entryId))
        results.updated++
      } else {
        // Create new entry
        await db.insert(feedEntries).values({
          ...entryData,
          createdAt: new Date(),
        })
        results.created++
      }
    } catch (error) {
      const errorMessage = `Failed to sync blog post "${post.slug}": ${
        error instanceof Error ? error.message : String(error)
      }`
      results.errors.push(errorMessage)
      console.error(errorMessage)
      results.success = false
    }
  }

  results.syncedCount = results.created + results.updated

  return results
}
