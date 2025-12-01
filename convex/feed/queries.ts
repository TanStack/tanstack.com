import { query } from '../_generated/server'
import { v } from 'convex/values'
import { getEffectivePublishedAt } from './timestamps'
import { feedCategoryValidator, releaseLevelValidator } from './schema'

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
        categories: v.optional(v.array(feedCategoryValidator)),
        partners: v.optional(v.array(v.string())),
        tags: v.optional(v.array(v.string())),
        releaseLevels: v.optional(v.array(releaseLevelValidator)),
        includePrerelease: v.optional(v.boolean()), // Separate toggle for prerelease releases
        featured: v.optional(v.boolean()),
        search: v.optional(v.string()),
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

    // Filter by release levels if specified
    // - undefined/not present: show all entries (no filtering)
    // - empty array []: show only non-release entries (filter out all releases)
    // - array with values: show entries matching those release levels (excluding prerelease unless includePrerelease is true)
    if (filters.releaseLevels !== undefined) {
      entries = entries.filter((entry) => {
        // Check if entry has release level tags
        const releaseLevelTags = entry.tags.filter((tag) =>
          tag.startsWith('release:')
        )
        if (releaseLevelTags.length === 0) {
          // Not a release entry, include it (unless explicitly filtering releases only)
          return true
        }
        // If releaseLevels is empty array, exclude all releases
        if (filters.releaseLevels!.length === 0) {
          return false
        }

        // Check if this is a prerelease
        const isPrerelease = releaseLevelTags.some(
          (tag) => tag === 'release:prerelease'
        )

        // If it's a prerelease, check includePrerelease flag
        if (isPrerelease && filters.includePrerelease !== true) {
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
        const level = baseReleaseTag.replace('release:', '') as
          | 'major'
          | 'minor'
          | 'patch'
        return filters.releaseLevels!.includes(level)
      })
    } else if (filters.includePrerelease === false) {
      // If releaseLevels is not specified but includePrerelease is explicitly false, exclude prerelease
      entries = entries.filter((entry) => {
        const hasPrereleaseTag = entry.tags.includes('release:prerelease')
        return !hasPrereleaseTag
      })
    }

    if (filters.featured !== undefined) {
      entries = entries.filter((entry) => entry.featured === filters.featured)
    }

    // Search by title if provided
    if (filters.search && filters.search.length > 0) {
      const searchLower = filters.search.toLowerCase()
      entries = entries.filter((entry) =>
        entry.title.toLowerCase().includes(searchLower)
      )
    }

    // Sort: latest first (by publishedAt), with featured as tiebreaker
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

      // If still tied, maintain order (stable sort)
      return 0
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

export const getFeedEntryById = query({
  args: {
    id: v.id('feedEntries'),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id)
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

export const getFeedFacetCounts = query({
  args: {
    filters: v.optional(
      v.object({
        sources: v.optional(v.array(v.string())),
        libraries: v.optional(v.array(v.string())),
        categories: v.optional(v.array(feedCategoryValidator)),
        partners: v.optional(v.array(v.string())),
        tags: v.optional(v.array(v.string())),
        releaseLevels: v.optional(v.array(releaseLevelValidator)),
        includePrerelease: v.optional(v.boolean()),
        featured: v.optional(v.boolean()),
        search: v.optional(v.string()),
        includeHidden: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
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

    // Apply all filters EXCEPT the one we're counting (we'll count each facet separately)
    // This gives us the "base" set of entries that match current filters

    // Apply source filter (but we'll count sources separately)
    // Apply category filter (but we'll count categories separately)
    // etc.

    // For facet counts, we want to show: "if I select this option, how many entries match?"
    // So we apply all OTHER filters, then count by the facet we're interested in

    // Helper function to apply filters except for a specific facet
    const applyFiltersExcept = (
      entriesToFilter: typeof entries,
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
      let filtered = [...entriesToFilter]

      if (
        excludeFacet !== 'sources' &&
        filters.sources &&
        filters.sources.length > 0
      ) {
        filtered = filtered.filter((entry) =>
          filters.sources!.includes(entry.source)
        )
      }

      if (
        excludeFacet !== 'categories' &&
        filters.categories &&
        filters.categories.length > 0
      ) {
        filtered = filtered.filter((entry) =>
          filters.categories!.includes(entry.category)
        )
      }

      if (
        excludeFacet !== 'libraries' &&
        filters.libraries &&
        filters.libraries.length > 0
      ) {
        filtered = filtered.filter((entry) =>
          entry.libraryIds.some((libId) => filters.libraries!.includes(libId))
        )
      }

      if (
        excludeFacet !== 'partners' &&
        filters.partners &&
        filters.partners.length > 0
      ) {
        filtered = filtered.filter(
          (entry) =>
            entry.partnerIds &&
            entry.partnerIds.some((partnerId) =>
              filters.partners!.includes(partnerId)
            )
        )
      }

      if (excludeFacet !== 'tags' && filters.tags && filters.tags.length > 0) {
        filtered = filtered.filter((entry) =>
          filters.tags!.some((tag) => entry.tags.includes(tag))
        )
      }

      if (
        excludeFacet !== 'releaseLevels' &&
        excludeFacet !== 'includePrerelease'
      ) {
        if (filters.releaseLevels !== undefined) {
          filtered = filtered.filter((entry) => {
            const releaseLevelTags = entry.tags.filter((tag) =>
              tag.startsWith('release:')
            )
            if (releaseLevelTags.length === 0) {
              return true
            }
            if (filters.releaseLevels!.length === 0) {
              return false
            }
            const isPrerelease = releaseLevelTags.some(
              (tag) => tag === 'release:prerelease'
            )
            if (isPrerelease && filters.includePrerelease !== true) {
              return false
            }
            const baseReleaseTag = releaseLevelTags.find(
              (tag) =>
                tag === 'release:major' ||
                tag === 'release:minor' ||
                tag === 'release:patch'
            )
            if (!baseReleaseTag) {
              return false
            }
            const level = baseReleaseTag.replace('release:', '') as
              | 'major'
              | 'minor'
              | 'patch'
            return filters.releaseLevels!.includes(level)
          })
        } else if (filters.includePrerelease === false) {
          filtered = filtered.filter((entry) => {
            const hasPrereleaseTag = entry.tags.includes('release:prerelease')
            return !hasPrereleaseTag
          })
        }
      }

      if (excludeFacet !== 'featured' && filters.featured !== undefined) {
        filtered = filtered.filter(
          (entry) => entry.featured === filters.featured
        )
      }

      if (
        excludeFacet !== 'search' &&
        filters.search &&
        filters.search.length > 0
      ) {
        const searchLower = filters.search.toLowerCase()
        filtered = filtered.filter((entry) =>
          entry.title.toLowerCase().includes(searchLower)
        )
      }

      return filtered
    }

    // Count by source
    const sourceCounts: Record<string, number> = {}
    const sourceEntries = applyFiltersExcept(entries, 'sources')
    for (const entry of sourceEntries) {
      sourceCounts[entry.source] = (sourceCounts[entry.source] ?? 0) + 1
    }

    // Count by category
    const categoryCounts: Record<string, number> = {}
    const categoryEntries = applyFiltersExcept(entries, 'categories')
    for (const entry of categoryEntries) {
      categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1
    }

    // Count by library
    const libraryCounts: Record<string, number> = {}
    const libraryEntries = applyFiltersExcept(entries, 'libraries')
    for (const entry of libraryEntries) {
      for (const libId of entry.libraryIds) {
        libraryCounts[libId] = (libraryCounts[libId] ?? 0) + 1
      }
    }

    // Count by partner
    const partnerCounts: Record<string, number> = {}
    const partnerEntries = applyFiltersExcept(entries, 'partners')
    for (const entry of partnerEntries) {
      if (entry.partnerIds) {
        for (const partnerId of entry.partnerIds) {
          partnerCounts[partnerId] = (partnerCounts[partnerId] ?? 0) + 1
        }
      }
    }

    // Count by release level
    const releaseLevelCounts: Record<string, number> = {}
    const releaseEntries = applyFiltersExcept(entries, 'releaseLevels')
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

    // Count prerelease (separate from release levels)
    const prereleaseEntries = applyFiltersExcept(entries, 'includePrerelease')
    const prereleaseCount = prereleaseEntries.filter((entry) =>
      entry.tags.includes('release:prerelease')
    ).length

    // Count featured
    const featuredEntries = applyFiltersExcept(entries, 'featured')
    const featuredCount = featuredEntries.filter((entry) => entry.featured).length

    return {
      sources: sourceCounts,
      categories: categoryCounts,
      libraries: libraryCounts,
      partners: partnerCounts,
      releaseLevels: releaseLevelCounts,
      prerelease: prereleaseCount,
      featured: featuredCount,
    }
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
