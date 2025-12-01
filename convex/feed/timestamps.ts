/**
 * Timestamp management for feed entries
 * 
 * Timestamp semantics:
 * - publishedAt: When the content was originally published (from source or manually set)
 *   This is the primary timestamp for sorting and display - represents when content was actually published
 * - createdAt: When the entry was created in our feed system (when we added it to the database)
 * - updatedAt: When the entry was last modified in our system
 * - lastSyncedAt: When we last synced from external source (only for auto-synced entries)
 * - _createdAt: Convex internal timestamp (automatic, don't use in business logic)
 * 
 * Rules:
 * - Always sort by publishedAt (when content was published, not when we added it)
 * - createdAt should never be used for display/sorting
 * - For auto-synced entries, publishedAt should never be updated during sync (preserve original)
 * - For manual entries, publishedAt must be explicitly set (no default to today)
 */

/**
 * Get the effective published date for sorting/display
 * Falls back to createdAt if publishedAt is invalid (shouldn't happen, but safety check)
 */
export function getEffectivePublishedAt(entry: {
  publishedAt: number
  createdAt: number
}): number {
  // Validate publishedAt is reasonable (not in future, not before Unix epoch)
  const now = Date.now()
  const minDate = 0 // Unix epoch
  const maxDate = now + 24 * 60 * 60 * 1000 // Allow up to 24h in future for timezone issues

  if (
    entry.publishedAt >= minDate &&
    entry.publishedAt <= maxDate &&
    !isNaN(entry.publishedAt)
  ) {
    return entry.publishedAt
  }

  // Fallback to createdAt if publishedAt is invalid
  console.warn(
    `Invalid publishedAt (${entry.publishedAt}) for entry, using createdAt (${entry.createdAt})`
  )
  return entry.createdAt
}

/**
 * Validate that publishedAt is reasonable
 */
export function validatePublishedAt(publishedAt: number): {
  valid: boolean
  error?: string
} {
  const now = Date.now()
  const minDate = 0
  const maxDate = now + 24 * 60 * 60 * 1000 // Allow 24h in future for timezone issues

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

