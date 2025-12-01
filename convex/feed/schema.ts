/**
 * Shared feed schema constants - single source of truth for frontend and backend
 */

import { v } from 'convex/values'

export const FEED_CATEGORIES = [
  'release',
  'announcement',
  'blog',
  'partner',
  'update',
  'other',
] as const

export type FeedCategory = (typeof FEED_CATEGORIES)[number]

export const RELEASE_LEVELS = ['major', 'minor', 'patch'] as const

export type ReleaseLevel = (typeof RELEASE_LEVELS)[number]

/**
 * Convex validators derived from constants
 */
export const feedCategoryValidator = v.union(
  ...FEED_CATEGORIES.map((cat) => v.literal(cat))
)

export const releaseLevelValidator = v.union(
  ...RELEASE_LEVELS.map((level) => v.literal(level))
)
