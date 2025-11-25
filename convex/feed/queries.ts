import { query } from '../_generated/server'
import { v } from 'convex/values'
import { getEffectivePublishedAt } from './timestamps'

export const listFeedEntries = query({
  args: {
    pagination: v.object({
      limit: v.number(),
      page: v.optional(v.number()),
    }),
    filters: v.optional(
      v.object({
        sources: v.optional(v.array(v.string())),
        libraries: v.optional(v.array(v.string())),
        categories: v.optional(
          v.array(
            v.union(
              v.literal('release'),
              v.literal('announcement'),
              v.literal('blog'),
              v.literal('partner'),
              v.literal('update'),
              v.literal('other')
            )
          )
        ),
        partners: v.optional(v.array(v.string())),
        tags: v.optional(v.array(v.string())),
        hidePatch: v.optional(v.boolean()),
        featured: v.optional(v.boolean()),
        search: v.optional(v.string()),
        minPriority: v.optional(v.number()),
        includeHidden: v.optional(v.boolean()), // Admin flag to show all entries
      })
    ),
  },
  handler: async (ctx, args) => {
    const limit = args.pagination.limit
    const pageIndex = args.pagination.page ?? 0
    const filters = args.filters ?? {}
    const includeHidden = filters.includeHidden ?? false

    // Start with base query - filter by visibility unless admin wants all
    let entries = includeHidden
      ? await ctx.db.query('feedEntries').collect()
      : await ctx.db
          .query('feedEntries')
          .withIndex('by_visible', (q) =>
            q.eq('isVisible', true).gte('publishedAt', 0)
          )
          .collect()

    // Apply filters
    if (filters.sources && filters.sources.length > 0) {
      entries = entries.filter((entry) =>
        filters.sources!.includes(entry.source)
      )
    }

    if (filters.categories && filters.categories.length > 0) {
      entries = entries.filter((entry) =>
        filters.categories!.includes(entry.category)
      )
    }

    if (filters.libraries && filters.libraries.length > 0) {
      entries = entries.filter((entry) =>
        entry.libraryIds.some((libId) => filters.libraries!.includes(libId))
      )
    }

    if (filters.partners && filters.partners.length > 0) {
      entries = entries.filter(
        (entry) =>
          entry.partnerIds &&
          entry.partnerIds.some((partnerId) =>
            filters.partners!.includes(partnerId)
          )
      )
    }

    if (filters.tags && filters.tags.length > 0) {
      entries = entries.filter((entry) =>
        filters.tags!.some((tag) => entry.tags.includes(tag))
      )
    }

    // Hide patch releases if requested (check for release:patch tag)
    if (filters.hidePatch) {
      entries = entries.filter((entry) => !entry.tags.includes('release:patch'))
    }

    if (filters.featured !== undefined) {
      entries = entries.filter((entry) => entry.featured === filters.featured)
    }

    if (filters.minPriority !== undefined) {
      entries = entries.filter(
        (entry) => (entry.priority ?? 0) >= filters.minPriority!
      )
    }

    // Search by title if provided
    if (filters.search && filters.search.length > 0) {
      const searchLower = filters.search.toLowerCase()
      entries = entries.filter((entry) =>
        entry.title.toLowerCase().includes(searchLower)
      )
    }

    // Sort: latest first (by publishedAt), with featured/priority as tiebreakers
    // Use effective publishedAt (handles edge cases where publishedAt might be invalid)
    entries.sort((a, b) => {
      // Primary sort: publishedAt (newer first) - this represents when content was actually published
      const publishedA = getEffectivePublishedAt(a)
      const publishedB = getEffectivePublishedAt(b)
      const timeDiff = publishedB - publishedA
      if (timeDiff !== 0) return timeDiff

      // Tiebreaker: featured items first
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1

      // Final tiebreaker: priority (higher first)
      const priorityA = a.priority ?? 0
      const priorityB = b.priority ?? 0
      return priorityB - priorityA
    })

    // Pagination
    const start = Math.max(0, pageIndex * limit)
    const end = start + limit
    const page = entries.slice(start, end)
    const hasMore = end < entries.length

    return {
      page,
      isDone: !hasMore,
      counts: {
        total: entries.length,
        pages: Math.max(1, Math.ceil(entries.length / limit)),
      },
    }
  },
})

export const getFeedEntry = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query('feedEntries')
      .filter((q) => q.eq(q.field('id'), args.id))
      .first()

    return entry ?? null
  },
})

export const getFeedStats = query({
  args: {},
  handler: async (ctx) => {
    const allEntries = await ctx.db.query('feedEntries').collect()

    const stats = {
      total: allEntries.length,
      bySource: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byLibrary: {} as Record<string, number>,
      visible: 0,
      featured: 0,
    }

    for (const entry of allEntries) {
      // Count by source
      stats.bySource[entry.source] = (stats.bySource[entry.source] ?? 0) + 1

      // Count by category
      stats.byCategory[entry.category] =
        (stats.byCategory[entry.category] ?? 0) + 1

      // Count by library
      for (const libId of entry.libraryIds) {
        stats.byLibrary[libId] = (stats.byLibrary[libId] ?? 0) + 1
      }

      if (entry.isVisible) stats.visible++
      if (entry.featured) stats.featured++
    }

    return stats
  },
})

export const searchFeedEntries = query({
  args: {
    search: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20
    const searchLower = args.search.toLowerCase()

    // Use search index if available, otherwise fallback to filter
    const entries = await ctx.db
      .query('feedEntries')
      .withSearchIndex('search_content', (q) => q.search('title', searchLower))
      .filter((q) => q.eq(q.field('isVisible'), true))
      .take(limit)

    return entries
  },
})

export const getFeedConfig = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query('feedConfig')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .first()

    return config ?? null
  },
})
