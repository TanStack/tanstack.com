import { db } from '~/db/client'
import { feedEntries } from '~/db/schema'
import { eq, and, sql, inArray, gte } from 'drizzle-orm'
import { getAuthenticatedUser } from './auth.server-helpers'
import { getEffectiveCapabilities } from './capabilities.server'
import type { FeedCategory, ReleaseLevel } from '~/db/schema'

// Helper function to validate admin capability
export async function requireAdmin() {
  const user = await getAuthenticatedUser()
  const effectiveCapabilities = await getEffectiveCapabilities(user.userId)
  if (!effectiveCapabilities.includes('admin')) {
    throw new Error('admin capability required')
  }
}

// Helper function to get effective publishedAt (for sorting)
export function getEffectivePublishedAt(entry: {
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
export function validatePublishedAt(publishedAt: number): {
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
export function buildFeedQueryConditions(
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
export function filterByReleaseLevel(
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
