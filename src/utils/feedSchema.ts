/**
 * Feed schema constants and types for frontend code
 * Defined here to avoid importing drizzle-orm into client bundles
 */

// Feed categories (must match db/schema.ts)
export const FEED_CATEGORIES = [
  'release',
  'announcement',
  'blog',
  'partner',
  'update',
  'other',
] as const

export type FeedCategory = (typeof FEED_CATEGORIES)[number]

// Release levels (must match db/schema.ts)
export const RELEASE_LEVELS = ['major', 'minor', 'patch'] as const

export type ReleaseLevel = (typeof RELEASE_LEVELS)[number]

