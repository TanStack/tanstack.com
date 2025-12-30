/**
 * Shared feed defaults configuration
 * This ensures public and admin feeds stay in sync
 */

export const FEED_DEFAULTS = {
  // Default to major and minor releases only (exclude patches)
  releaseLevels: ['major', 'minor'] as const,
  includePrerelease: undefined as undefined,
  sources: undefined as undefined,
  libraries: undefined as undefined,
  categories: undefined as undefined,
  partners: undefined as undefined,
  tags: undefined as undefined,
  featured: undefined as undefined,
  search: undefined as undefined,
  // Pagination defaults
  page: 1,
  pageSize: 50,
  viewMode: 'table' as const,
} as const
