import { feedEntries } from '~/db/schema'
import { eq, and, sql, inArray, gte, lte, arrayOverlaps } from 'drizzle-orm'
import { getAuthenticatedUser } from './auth.server-helpers'
import { getEffectiveCapabilities } from './capabilities.server'
import type { EntryType, ReleaseLevel } from '~/db/schema'

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
    entryTypes?: EntryType[]
    libraries?: string[]
    partners?: string[]
    tags?: string[]
    releaseLevels?: ReleaseLevel[]
    includePrerelease?: boolean
    featured?: boolean
    search?: string
    includeHidden?: boolean
  },
  excludeFacet?:
    | 'entryTypes'
    | 'libraries'
    | 'partners'
    | 'tags'
    | 'releaseLevels'
    | 'includePrerelease'
    | 'featured'
    | 'search',
) {
  const conditions = []

  // Visibility filter
  if (!filters.includeHidden) {
    conditions.push(eq(feedEntries.showInFeed, true))
    conditions.push(gte(feedEntries.publishedAt, new Date(0)))
    // Exclude future entries (unless admin viewing hidden)
    conditions.push(lte(feedEntries.publishedAt, new Date()))
  }

  // Entry type filter
  if (
    excludeFacet !== 'entryTypes' &&
    filters.entryTypes &&
    filters.entryTypes.length > 0
  ) {
    conditions.push(inArray(feedEntries.entryType, filters.entryTypes))
  }

  // Library filter (array overlap) - use parameterized array
  if (
    excludeFacet !== 'libraries' &&
    filters.libraries &&
    filters.libraries.length > 0
  ) {
    conditions.push(arrayOverlaps(feedEntries.libraryIds, filters.libraries))
  }

  // Partner filter (array overlap) - use parameterized array
  if (
    excludeFacet !== 'partners' &&
    filters.partners &&
    filters.partners.length > 0
  ) {
    conditions.push(arrayOverlaps(feedEntries.partnerIds, filters.partners))
  }

  // Tag filter (array overlap) - use parameterized array
  if (excludeFacet !== 'tags' && filters.tags && filters.tags.length > 0) {
    conditions.push(arrayOverlaps(feedEntries.tags, filters.tags))
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
    // Use PostgreSQL full-text search with plainto_tsquery for safe input handling
    // plainto_tsquery automatically handles special characters and escaping
    const searchInput = filters.search.trim()
    conditions.push(
      sql`to_tsvector('english', ${feedEntries.title} || ' ' || ${feedEntries.content} || ' ' || COALESCE(${feedEntries.excerpt}, '')) @@ plainto_tsquery('english', ${searchInput})`,
    )
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

// Helper function to filter entries by release level (in-memory, complex logic)
export function filterByReleaseLevel(
  entries: (typeof feedEntries.$inferSelect)[],
  releaseLevels?: ReleaseLevel[],
  includePrerelease?: boolean,
) {
  if (releaseLevels === undefined) {
    // If releaseLevels not specified but includePrerelease is explicitly false, exclude prerelease
    if (includePrerelease === false) {
      return entries.filter(
        (entry) => !entry.tags.includes('release:prerelease'),
      )
    }
    return entries
  }

  return entries.filter((entry) => {
    const releaseLevelTags = entry.tags.filter((tag) =>
      tag.startsWith('release:'),
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
      (tag) => tag === 'release:prerelease',
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
        tag === 'release:patch',
    )
    if (!baseReleaseTag) {
      return false
    }
    const level = baseReleaseTag.replace('release:', '') as ReleaseLevel
    return releaseLevels.includes(level)
  })
}
