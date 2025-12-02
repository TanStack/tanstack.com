import { createServerFn } from '@tanstack/react-start'
import { db } from '~/db/client'
import { feedEntries, feedConfig } from '~/db/schema'
import { eq, and, or, sql, inArray, ilike, gte, lt } from 'drizzle-orm'
import { getAuthenticatedUser } from './auth.server-helpers'
import { getEffectiveCapabilities } from './capabilities'
import { z } from 'zod'
import type { FeedCategory, ReleaseLevel } from '~/db/schema'

// Helper function to validate admin capability
async function requireAdmin() {
  const user = await getAuthenticatedUser()
  const effectiveCapabilities = await getEffectiveCapabilities(user.userId)
  if (!effectiveCapabilities.includes('admin')) {
    throw new Error('admin capability required')
  }
}

// Helper function to get effective publishedAt (for sorting)
function getEffectivePublishedAt(entry: {
  publishedAt: Date
  createdAt: Date
}): number {
  const now = Date.now()
  const minDate = 0
  const maxDate = now + 24 * 60 * 60 * 1000

  const publishedAtMs = entry.publishedAt.getTime()

  if (
    publishedAtMs >= minDate &&
    publishedAtMs <= maxDate &&
    !isNaN(publishedAtMs)
  ) {
    return publishedAtMs
  }

  return entry.createdAt.getTime()
}

// Helper function to validate publishedAt
function validatePublishedAt(publishedAt: number): {
  valid: boolean
  error?: string
} {
  const now = Date.now()
  const minDate = 0
  const maxDate = now + 24 * 60 * 60 * 1000

  if (isNaN(publishedAt)) {
    return { valid: false, error: 'publishedAt must be a valid number' }
  }

  if (publishedAt < minDate) {
    return { valid: false, error: 'publishedAt cannot be before Unix epoch' }
  }

  if (publishedAt > maxDate) {
    return {
      valid: false,
      error: 'publishedAt cannot be more than 24 hours in the future',
    }
  }

  return { valid: true }
}

// Helper function to apply filters to feed entries query
function buildFeedQueryConditions(
  filters: {
    sources?: string[]
    libraries?: string[]
    categories?: FeedCategory[]
    partners?: string[]
    tags?: string[]
    releaseLevels?: ReleaseLevel[]
    includePrerelease?: boolean
    featured?: boolean
    search?: string
    includeHidden?: boolean
  },
  excludeFacet?:
    | 'sources'
    | 'categories'
    | 'libraries'
    | 'partners'
    | 'tags'
    | 'releaseLevels'
    | 'includePrerelease'
    | 'featured'
    | 'search'
) {
  const conditions = []

  // Visibility filter
  if (!filters.includeHidden) {
    conditions.push(eq(feedEntries.isVisible, true))
    conditions.push(gte(feedEntries.publishedAt, new Date(0)))
  }

  // Source filter
  if (
    excludeFacet !== 'sources' &&
    filters.sources &&
    filters.sources.length > 0
  ) {
    conditions.push(inArray(feedEntries.source, filters.sources))
  }

  // Category filter
  if (
    excludeFacet !== 'categories' &&
    filters.categories &&
    filters.categories.length > 0
  ) {
    conditions.push(inArray(feedEntries.category, filters.categories))
  }

  // Library filter (array overlap)
  if (
    excludeFacet !== 'libraries' &&
    filters.libraries &&
    filters.libraries.length > 0
  ) {
    const libraryArray = `{${filters.libraries.map((l) => `"${l}"`).join(',')}}`
    conditions.push(
      sql`${feedEntries.libraryIds} && ${sql.raw(libraryArray)}::text[]`
    )
  }

  // Partner filter (array overlap)
  if (
    excludeFacet !== 'partners' &&
    filters.partners &&
    filters.partners.length > 0
  ) {
    const partnerArray = `{${filters.partners.map((p) => `"${p}"`).join(',')}}`
    conditions.push(
      sql`${feedEntries.partnerIds} && ${sql.raw(partnerArray)}::text[]`
    )
  }

  // Tag filter (array overlap)
  if (excludeFacet !== 'tags' && filters.tags && filters.tags.length > 0) {
    const tagArray = `{${filters.tags.map((t) => `"${t}"`).join(',')}}`
    conditions.push(sql`${feedEntries.tags} && ${sql.raw(tagArray)}::text[]`)
  }

  // Featured filter
  if (excludeFacet !== 'featured' && filters.featured !== undefined) {
    conditions.push(eq(feedEntries.featured, filters.featured))
  }

  // Search filter (full-text search)
  if (
    excludeFacet !== 'search' &&
    filters.search &&
    filters.search.length > 0
  ) {
    // Use PostgreSQL full-text search on textsearch column
    // Note: This requires the textsearch column and index to be set up (see migrations README)
    const searchQuery = filters.search
      .split(/\s+/)
      .map((term) => `'${term.replace(/'/g, "''")}'`)
      .join(' & ')
    conditions.push(
      sql`to_tsvector('english', ${feedEntries.title} || ' ' || ${feedEntries.content} || ' ' || COALESCE(${feedEntries.excerpt}, '')) @@ to_tsquery('english', ${searchQuery})`
    )
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

// Helper function to filter entries by release level (in-memory, complex logic)
function filterByReleaseLevel(
  entries: (typeof feedEntries.$inferSelect)[],
  releaseLevels?: ReleaseLevel[],
  includePrerelease?: boolean
) {
  if (releaseLevels === undefined) {
    // If releaseLevels not specified but includePrerelease is explicitly false, exclude prerelease
    if (includePrerelease === false) {
      return entries.filter(
        (entry) => !entry.tags.includes('release:prerelease')
      )
    }
    return entries
  }

  return entries.filter((entry) => {
    const releaseLevelTags = entry.tags.filter((tag) =>
      tag.startsWith('release:')
    )
    if (releaseLevelTags.length === 0) {
      // Not a release entry, include it (unless explicitly filtering releases only)
      return true
    }
    // If releaseLevels is empty array, exclude all releases
    if (releaseLevels.length === 0) {
      return false
    }

    // Check if this is a prerelease
    const isPrerelease = releaseLevelTags.some(
      (tag) => tag === 'release:prerelease'
    )

    // If it's a prerelease, check includePrerelease flag
    if (isPrerelease && includePrerelease !== true) {
      return false
    }

    // Check if the base release level (major/minor/patch) is included
    const baseReleaseTag = releaseLevelTags.find(
      (tag) =>
        tag === 'release:major' ||
        tag === 'release:minor' ||
        tag === 'release:patch'
    )
    if (!baseReleaseTag) {
      return false
    }
    const level = baseReleaseTag.replace('release:', '') as ReleaseLevel
    return releaseLevels.includes(level)
  })
}

// Server function wrapper for listFeedEntries
export const listFeedEntries = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      pagination: z.object({
        limit: z.number(),
        page: z.number().optional(),
      }),
      filters: z
        .object({
          sources: z.array(z.string()).optional(),
          libraries: z.array(z.string()).optional(),
          categories: z
            .array(
              z.enum([
                'release',
                'announcement',
                'blog',
                'partner',
                'update',
                'other',
              ])
            )
            .optional(),
          partners: z.array(z.string()).optional(),
          tags: z.array(z.string()).optional(),
          releaseLevels: z
            .array(z.enum(['major', 'minor', 'patch']))
            .optional(),
          includePrerelease: z.boolean().optional(),
          featured: z.boolean().optional(),
          search: z.string().optional(),
          includeHidden: z.boolean().optional(),
        })
        .optional(),
    })
  )
  .handler(async ({ data }) => {
    // Check if admin (for includeHidden)
    let isAdmin = false
    try {
      await requireAdmin()
      isAdmin = true
    } catch {
      // Not admin, continue
    }

    const limit = data.pagination.limit
    const pageIndex = data.pagination.page ?? 0
    const filters = data.filters ?? {}
    const includeHidden = filters.includeHidden ?? false

    // Build query conditions
    const whereClause = buildFeedQueryConditions(filters)

    // Get all matching entries
    let allEntries = await db
      .select()
      .from(feedEntries)
      .where(whereClause)
      .orderBy(sql`${feedEntries.publishedAt} DESC`)

    // Apply release level filter (complex logic, done in-memory)
    allEntries = filterByReleaseLevel(
      allEntries,
      filters.releaseLevels,
      filters.includePrerelease
    )

    // Sort: latest first (by publishedAt), with featured as tiebreaker
    allEntries.sort((a, b) => {
      const publishedA = getEffectivePublishedAt(a)
      const publishedB = getEffectivePublishedAt(b)
      const timeDiff = publishedB - publishedA
      if (timeDiff !== 0) return timeDiff

      // Tiebreaker: featured items first
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1

      return 0
    })

    // Pagination
    const start = Math.max(0, pageIndex * limit)
    const end = start + limit
    const page = allEntries.slice(start, end)
    const hasMore = end < allEntries.length

    // Transform to match expected format
    const transformedPage = page.map((entry) => ({
      _id: entry.entryId,
      id: entry.entryId,
      source: entry.source,
      title: entry.title,
      content: entry.content,
      excerpt: entry.excerpt,
      publishedAt: entry.publishedAt.getTime(),
      createdAt: entry.createdAt.getTime(),
      updatedAt: entry.updatedAt.getTime(),
      metadata: entry.metadata ?? {},
      libraryIds: entry.libraryIds,
      partnerIds: entry.partnerIds,
      tags: entry.tags,
      category: entry.category,
      isVisible: entry.isVisible,
      featured: entry.featured ?? false,
      autoSynced: entry.autoSynced,
      lastSyncedAt: entry.lastSyncedAt?.getTime(),
    }))

    return {
      page: transformedPage,
      isDone: !hasMore,
      counts: {
        total: allEntries.length,
        pages: Math.max(1, Math.ceil(allEntries.length / limit)),
      },
    }
  })

// Server function wrapper for getFeedEntry
export const getFeedEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const entry = await db.query.feedEntries.findFirst({
      where: eq(feedEntries.entryId, data.id),
    })

    if (!entry) {
      return null
    }

    return {
      _id: entry.entryId,
      id: entry.entryId,
      source: entry.source,
      title: entry.title,
      content: entry.content,
      excerpt: entry.excerpt,
      publishedAt: entry.publishedAt.getTime(),
      createdAt: entry.createdAt.getTime(),
      updatedAt: entry.updatedAt.getTime(),
      metadata: entry.metadata ?? {},
      libraryIds: entry.libraryIds,
      partnerIds: entry.partnerIds,
      tags: entry.tags,
      category: entry.category,
      isVisible: entry.isVisible,
      featured: entry.featured ?? false,
      autoSynced: entry.autoSynced,
      lastSyncedAt: entry.lastSyncedAt?.getTime(),
    }
  })

// Server function wrapper for getFeedEntryById
export const getFeedEntryById = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const entry = await db.query.feedEntries.findFirst({
      where: eq(feedEntries.entryId, data.id),
    })

    if (!entry) {
      return null
    }

    return {
      _id: entry.entryId,
      id: entry.entryId,
      source: entry.source,
      title: entry.title,
      content: entry.content,
      excerpt: entry.excerpt,
      publishedAt: entry.publishedAt.getTime(),
      createdAt: entry.createdAt.getTime(),
      updatedAt: entry.updatedAt.getTime(),
      metadata: entry.metadata ?? {},
      libraryIds: entry.libraryIds,
      partnerIds: entry.partnerIds,
      tags: entry.tags,
      category: entry.category,
      isVisible: entry.isVisible,
      featured: entry.featured ?? false,
      autoSynced: entry.autoSynced,
      lastSyncedAt: entry.lastSyncedAt?.getTime(),
    }
  })

// Server function wrapper for getFeedStats
export const getFeedStats = createServerFn({ method: 'POST' }).handler(
  async () => {
    const allEntries = await db.select().from(feedEntries)

    const stats = {
      total: allEntries.length,
      bySource: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byLibrary: {} as Record<string, number>,
      visible: 0,
      featured: 0,
    }

    for (const entry of allEntries) {
      stats.bySource[entry.source] = (stats.bySource[entry.source] ?? 0) + 1
      stats.byCategory[entry.category] =
        (stats.byCategory[entry.category] ?? 0) + 1

      for (const libId of entry.libraryIds) {
        stats.byLibrary[libId] = (stats.byLibrary[libId] ?? 0) + 1
      }

      if (entry.isVisible) stats.visible++
      if (entry.featured) stats.featured++
    }

    return stats
  }
)

// Server function wrapper for getFeedFacetCounts
export const getFeedFacetCounts = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      filters: z
        .object({
          sources: z.array(z.string()).optional(),
          libraries: z.array(z.string()).optional(),
          categories: z
            .array(
              z.enum([
                'release',
                'announcement',
                'blog',
                'partner',
                'update',
                'other',
              ])
            )
            .optional(),
          partners: z.array(z.string()).optional(),
          tags: z.array(z.string()).optional(),
          releaseLevels: z
            .array(z.enum(['major', 'minor', 'patch']))
            .optional(),
          includePrerelease: z.boolean().optional(),
          featured: z.boolean().optional(),
          search: z.string().optional(),
          includeHidden: z.boolean().optional(),
        })
        .optional(),
    })
  )
  .handler(async ({ data }) => {
    const filters = data.filters ?? {}
    const includeHidden = filters.includeHidden ?? false

    // Helper function to apply filters except for a specific facet
    const applyFiltersExcept = (
      excludeFacet?:
        | 'sources'
        | 'categories'
        | 'libraries'
        | 'partners'
        | 'tags'
        | 'releaseLevels'
        | 'includePrerelease'
        | 'featured'
        | 'search'
    ) => {
      const whereClause = buildFeedQueryConditions(filters, excludeFacet)
      return db.select().from(feedEntries).where(whereClause)
    }

    // Get base entries (with visibility filter)
    const baseWhereClause = includeHidden
      ? undefined
      : and(
          eq(feedEntries.isVisible, true),
          gte(feedEntries.publishedAt, new Date(0))
        )
    const baseEntries = await db
      .select()
      .from(feedEntries)
      .where(baseWhereClause)

    // Count by source
    const sourceEntries = await applyFiltersExcept('sources')
    const sourceCounts: Record<string, number> = {}
    for (const entry of sourceEntries) {
      sourceCounts[entry.source] = (sourceCounts[entry.source] ?? 0) + 1
    }

    // Count by category
    const categoryEntries = await applyFiltersExcept('categories')
    const categoryCounts: Record<string, number> = {}
    for (const entry of categoryEntries) {
      categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1
    }

    // Count by library
    const libraryEntries = await applyFiltersExcept('libraries')
    const libraryCounts: Record<string, number> = {}
    for (const entry of libraryEntries) {
      for (const libId of entry.libraryIds) {
        libraryCounts[libId] = (libraryCounts[libId] ?? 0) + 1
      }
    }

    // Count by partner
    const partnerEntries = await applyFiltersExcept('partners')
    const partnerCounts: Record<string, number> = {}
    for (const entry of partnerEntries) {
      for (const partnerId of entry.partnerIds) {
        partnerCounts[partnerId] = (partnerCounts[partnerId] ?? 0) + 1
      }
    }

    // Count by release level (in-memory filtering)
    const releaseEntries = await applyFiltersExcept('releaseLevels')
    const releaseLevelCounts: Record<string, number> = {}
    for (const entry of releaseEntries) {
      const releaseLevelTags = entry.tags.filter((tag) =>
        tag.startsWith('release:')
      )
      if (releaseLevelTags.length > 0) {
        const baseReleaseTag = releaseLevelTags.find(
          (tag) =>
            tag === 'release:major' ||
            tag === 'release:minor' ||
            tag === 'release:patch'
        )
        if (baseReleaseTag) {
          const level = baseReleaseTag.replace('release:', '')
          releaseLevelCounts[level] = (releaseLevelCounts[level] ?? 0) + 1
        }
      }
    }

    // Count prerelease
    const prereleaseEntries = await applyFiltersExcept('includePrerelease')
    const prereleaseCount = prereleaseEntries.filter((entry) =>
      entry.tags.includes('release:prerelease')
    ).length

    // Count featured
    const featuredEntries = await applyFiltersExcept('featured')
    const featuredCount = featuredEntries.filter(
      (entry) => entry.featured
    ).length

    return {
      sources: sourceCounts,
      categories: categoryCounts,
      libraries: libraryCounts,
      partners: partnerCounts,
      releaseLevels: releaseLevelCounts,
      prerelease: prereleaseCount,
      featured: featuredCount,
    }
  })

// Server function wrapper for searchFeedEntries
export const searchFeedEntries = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      search: z.string(),
      limit: z.number().optional(),
    })
  )
  .handler(async ({ data }) => {
    const limit = data.limit ?? 20

    // Use PostgreSQL full-text search
    const searchQuery = data.search
      .split(/\s+/)
      .map((term) => `'${term.replace(/'/g, "''")}'`)
      .join(' & ')

    const entries = await db
      .select()
      .from(feedEntries)
      .where(
        and(
          eq(feedEntries.isVisible, true),
          sql`to_tsvector('english', ${feedEntries.title} || ' ' || ${feedEntries.content} || ' ' || COALESCE(${feedEntries.excerpt}, '')) @@ to_tsquery('english', ${searchQuery})`
        )
      )
      .limit(limit)

    return entries.map((entry) => ({
      _id: entry.entryId,
      id: entry.entryId,
      source: entry.source,
      title: entry.title,
      content: entry.content,
      excerpt: entry.excerpt,
      publishedAt: entry.publishedAt.getTime(),
      createdAt: entry.createdAt.getTime(),
      updatedAt: entry.updatedAt.getTime(),
      metadata: entry.metadata ?? {},
      libraryIds: entry.libraryIds,
      partnerIds: entry.partnerIds,
      tags: entry.tags,
      category: entry.category,
      isVisible: entry.isVisible,
      featured: entry.featured ?? false,
      autoSynced: entry.autoSynced,
      lastSyncedAt: entry.lastSyncedAt?.getTime(),
    }))
  })

// Server function wrapper for getFeedConfig
export const getFeedConfig = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ key: z.string() }))
  .handler(async ({ data }) => {
    const config = await db.query.feedConfig.findFirst({
      where: eq(feedConfig.key, data.key),
    })

    return config
      ? {
          _id: config.id,
          key: config.key,
          value: config.value ?? {},
          updatedAt: config.updatedAt.getTime(),
        }
      : null
  })

// Server function wrapper for createFeedEntry
export const createFeedEntry = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      source: z.string(),
      title: z.string(),
      content: z.string(),
      excerpt: z.string().optional(),
      publishedAt: z.number(),
      metadata: z.any().optional(),
      libraryIds: z.array(z.string()),
      partnerIds: z.array(z.string()).optional(),
      tags: z.array(z.string()),
      category: z.enum([
        'release',
        'announcement',
        'blog',
        'partner',
        'update',
        'other',
      ]),
      isVisible: z.boolean(),
      featured: z.boolean().optional(),
      autoSynced: z.boolean(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdmin()

    // Validate publishedAt
    const publishedAtValidation = validatePublishedAt(data.publishedAt)
    if (!publishedAtValidation.valid) {
      throw new Error(
        `Invalid publishedAt: ${publishedAtValidation.error}. publishedAt should represent when the content was actually published, not when it was added to the feed.`
      )
    }

    // Check if entry with this ID already exists
    const existing = await db.query.feedEntries.findFirst({
      where: eq(feedEntries.entryId, data.id),
    })

    if (existing) {
      throw new Error(
        `Feed entry with ID "${data.id}" already exists. Please try again or edit the existing entry.`
      )
    }

    const [newEntry] = await db
      .insert(feedEntries)
      .values({
        entryId: data.id, // Use data.id as entryId (unique identifier)
        source: data.source,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt,
        publishedAt: new Date(data.publishedAt),
        metadata: data.metadata ?? {},
        libraryIds: data.libraryIds,
        partnerIds: data.partnerIds ?? [],
        tags: data.tags,
        category: data.category,
        isVisible: data.isVisible,
        featured: data.featured ?? false,
        autoSynced: data.autoSynced,
        lastSyncedAt: data.autoSynced ? new Date() : undefined,
      })
      .returning()

    return newEntry.entryId
  })

// Server function wrapper for updateFeedEntry
export const updateFeedEntry = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
      excerpt: z.string().optional(),
      publishedAt: z.number().optional(),
      metadata: z.any().optional(),
      libraryIds: z.array(z.string()).optional(),
      partnerIds: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      category: z
        .enum(['release', 'announcement', 'blog', 'partner', 'update', 'other'])
        .optional(),
      isVisible: z.boolean().optional(),
      featured: z.boolean().optional(),
      lastSyncedAt: z.number().optional(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdmin()

    const entry = await db.query.feedEntries.findFirst({
      where: eq(feedEntries.entryId, data.id),
    })

    if (!entry) {
      throw new Error('Feed entry not found')
    }

    const updates: {
      title?: string
      content?: string
      excerpt?: string | null
      publishedAt?: Date
      metadata?: any
      libraryIds?: string[]
      partnerIds?: string[]
      tags?: string[]
      category?: FeedCategory
      isVisible?: boolean
      featured?: boolean
      lastSyncedAt?: Date | null
      updatedAt: Date
    } = {
      updatedAt: new Date(),
    }

    if (data.title !== undefined) updates.title = data.title
    if (data.content !== undefined) updates.content = data.content
    if (data.excerpt !== undefined) updates.excerpt = data.excerpt || null
    if (data.publishedAt !== undefined) {
      const publishedAtValidation = validatePublishedAt(data.publishedAt)
      if (!publishedAtValidation.valid) {
        throw new Error(
          `Invalid publishedAt: ${publishedAtValidation.error}. publishedAt should represent when the content was actually published.`
        )
      }
      updates.publishedAt = new Date(data.publishedAt)
    }
    if (data.metadata !== undefined) updates.metadata = data.metadata
    if (data.libraryIds !== undefined) updates.libraryIds = data.libraryIds
    if (data.partnerIds !== undefined) updates.partnerIds = data.partnerIds
    if (data.tags !== undefined) updates.tags = data.tags
    if (data.category !== undefined) updates.category = data.category
    if (data.isVisible !== undefined) updates.isVisible = data.isVisible
    if (data.featured !== undefined) updates.featured = data.featured
    if (data.lastSyncedAt !== undefined)
      updates.lastSyncedAt = data.lastSyncedAt
        ? new Date(data.lastSyncedAt)
        : null

    await db
      .update(feedEntries)
      .set(updates)
      .where(eq(feedEntries.entryId, data.id))

    return { success: true }
  })

// Server function wrapper for deleteFeedEntry
export const deleteFeedEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requireAdmin()

    const entry = await db.query.feedEntries.findFirst({
      where: eq(feedEntries.entryId, data.id),
    })

    if (!entry) {
      throw new Error('Feed entry not found')
    }

    // Soft delete by setting isVisible to false
    await db
      .update(feedEntries)
      .set({ isVisible: false, updatedAt: new Date() })
      .where(eq(feedEntries.entryId, data.id))

    return { success: true }
  })

// Server function wrapper for toggleFeedEntryVisibility
export const toggleFeedEntryVisibility = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      isVisible: z.boolean(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdmin()

    const entry = await db.query.feedEntries.findFirst({
      where: eq(feedEntries.entryId, data.id),
    })

    if (!entry) {
      throw new Error('Feed entry not found')
    }

    await db
      .update(feedEntries)
      .set({ isVisible: data.isVisible, updatedAt: new Date() })
      .where(eq(feedEntries.entryId, data.id))

    return { success: true }
  })

// Server function wrapper for setFeedEntryFeatured
export const setFeedEntryFeatured = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      featured: z.boolean(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdmin()

    const entry = await db.query.feedEntries.findFirst({
      where: eq(feedEntries.entryId, data.id),
    })

    if (!entry) {
      throw new Error('Feed entry not found')
    }

    await db
      .update(feedEntries)
      .set({ featured: data.featured, updatedAt: new Date() })
      .where(eq(feedEntries.entryId, data.id))

    return { success: true }
  })

// Server function wrapper for setFeedConfig
export const setFeedConfig = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      key: z.string(),
      value: z.any(),
    })
  )
  .handler(async ({ data }) => {
    // No admin check - config can be set by sync actions
    const existing = await db.query.feedConfig.findFirst({
      where: eq(feedConfig.key, data.key),
    })

    if (existing) {
      await db
        .update(feedConfig)
        .set({ value: data.value, updatedAt: new Date() })
        .where(eq(feedConfig.key, data.key))
    } else {
      await db.insert(feedConfig).values({
        key: data.key,
        value: data.value,
      })
    }

    return { success: true }
  })
