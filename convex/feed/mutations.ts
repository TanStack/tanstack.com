import { mutation } from '../_generated/server'
import { v } from 'convex/values'
import { QueryCtx } from '../_generated/server'
import { validatePublishedAt } from './timestamps'
import { requireCapability } from '../users'

// Helper function to validate admin capability (reuses requireCapability)
async function requireAdmin(ctx: QueryCtx) {
  return await requireCapability(ctx, 'admin')
}

export const createFeedEntry = mutation({
  args: {
    id: v.string(),
    source: v.string(),
    title: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    publishedAt: v.number(),
    metadata: v.optional(v.any()),
    libraryIds: v.array(v.string()),
    partnerIds: v.optional(v.array(v.string())),
    tags: v.array(v.string()),
    category: v.union(
      v.literal('release'),
      v.literal('announcement'),
      v.literal('blog'),
      v.literal('partner'),
      v.literal('update'),
      v.literal('other')
    ),
    isVisible: v.boolean(),
    featured: v.optional(v.boolean()),
    autoSynced: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Validate publishedAt
    const publishedAtValidation = validatePublishedAt(args.publishedAt)
    if (!publishedAtValidation.valid) {
      throw new Error(
        `Invalid publishedAt: ${publishedAtValidation.error}. publishedAt should represent when the content was actually published, not when it was added to the feed.`
      )
    }

    // Check if entry with this ID already exists
    const existing = await ctx.db
      .query('feedEntries')
      .filter((q) => q.eq(q.field('id'), args.id))
      .first()

    if (existing) {
      throw new Error(
        `Feed entry with ID "${args.id}" already exists. Please try again or edit the existing entry.`
      )
    }

    const now = Date.now()

    const entryId = await ctx.db.insert('feedEntries', {
      id: args.id,
      source: args.source,
      title: args.title,
      content: args.content,
      excerpt: args.excerpt,
      publishedAt: args.publishedAt,
      createdAt: now,
      updatedAt: now,
      metadata: args.metadata,
      libraryIds: args.libraryIds,
      partnerIds: args.partnerIds,
      tags: args.tags,
      category: args.category,
      isVisible: args.isVisible,
      featured: args.featured,
      autoSynced: args.autoSynced,
      lastSyncedAt: args.autoSynced ? now : undefined,
    })

    return entryId
  },
})

export const updateFeedEntry = mutation({
  args: {
    id: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
    libraryIds: v.optional(v.array(v.string())),
    partnerIds: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    category: v.optional(
      v.union(
        v.literal('release'),
        v.literal('announcement'),
        v.literal('blog'),
        v.literal('partner'),
        v.literal('update'),
        v.literal('other')
      )
    ),
    isVisible: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
    lastSyncedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const entry = await ctx.db
      .query('feedEntries')
      .filter((q) => q.eq(q.field('id'), args.id))
      .first()

    if (!entry) {
      throw new Error('Feed entry not found')
    }

    const updates: Partial<typeof entry> = {
      updatedAt: Date.now(),
    }

    if (args.title !== undefined) updates.title = args.title
    if (args.content !== undefined) updates.content = args.content
    if (args.excerpt !== undefined) updates.excerpt = args.excerpt
    if (args.publishedAt !== undefined) {
      // Validate publishedAt before updating
      const publishedAtValidation = validatePublishedAt(args.publishedAt)
      if (!publishedAtValidation.valid) {
        throw new Error(
          `Invalid publishedAt: ${publishedAtValidation.error}. publishedAt should represent when the content was actually published.`
        )
      }
      updates.publishedAt = args.publishedAt
    }
    if (args.metadata !== undefined) updates.metadata = args.metadata
    if (args.libraryIds !== undefined) updates.libraryIds = args.libraryIds
    if (args.partnerIds !== undefined) updates.partnerIds = args.partnerIds
    if (args.tags !== undefined) updates.tags = args.tags
    if (args.category !== undefined) updates.category = args.category
    if (args.isVisible !== undefined) updates.isVisible = args.isVisible
    if (args.featured !== undefined) updates.featured = args.featured
    if (args.lastSyncedAt !== undefined)
      updates.lastSyncedAt = args.lastSyncedAt

    await ctx.db.patch(entry._id, updates)

    return { success: true }
  },
})

export const deleteFeedEntry = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const entry = await ctx.db
      .query('feedEntries')
      .filter((q) => q.eq(q.field('id'), args.id))
      .first()

    if (!entry) {
      throw new Error('Feed entry not found')
    }

    // Soft delete by setting isVisible to false
    await ctx.db.patch(entry._id, {
      isVisible: false,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const toggleFeedEntryVisibility = mutation({
  args: {
    id: v.string(),
    isVisible: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const entry = await ctx.db
      .query('feedEntries')
      .filter((q) => q.eq(q.field('id'), args.id))
      .first()

    if (!entry) {
      throw new Error('Feed entry not found')
    }

    await ctx.db.patch(entry._id, {
      isVisible: args.isVisible,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const setFeedEntryFeatured = mutation({
  args: {
    id: v.string(),
    featured: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const entry = await ctx.db
      .query('feedEntries')
      .filter((q) => q.eq(q.field('id'), args.id))
      .first()

    if (!entry) {
      throw new Error('Feed entry not found')
    }

    await ctx.db.patch(entry._id, {
      featured: args.featured,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const setFeedConfig = mutation({
  args: {
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    // No admin check - config can be set by sync actions
    const existing = await ctx.db
      .query('feedConfig')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('feedConfig', {
        key: args.key,
        value: args.value,
        updatedAt: now,
      })
    }

    return { success: true }
  },
})

/**
 * Migration: Remove priority field and update manual source to announcement
 * Run this once to clean up existing entries
 */
export const migrateFeedEntries = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const entries = await ctx.db.query('feedEntries').collect()
    let updated = 0

    for (const entry of entries) {
      const updates: any = {}
      let needsUpdate = false

      // Check if entry has priority field (needs removal)
      const hasPriority = 'priority' in entry

      // Check if source needs updating
      if (entry.source === 'manual') {
        updates.source = 'announcement'
        needsUpdate = true
      }

      if (hasPriority || needsUpdate) {
        // For entries with priority, we need to replace them without that field
        if (hasPriority) {
          // Extract all fields except priority
          const { priority, _id, _creationTime, ...entryWithoutPriority } =
            entry as any
          await ctx.db.replace(entry._id, {
            ...entryWithoutPriority,
            ...updates,
            updatedAt: Date.now(),
          })
        } else {
          // Just update source
          await ctx.db.patch(entry._id, {
            ...updates,
            updatedAt: Date.now(),
          })
        }
        updated++
      }
    }

    return { success: true, updated }
  },
})
