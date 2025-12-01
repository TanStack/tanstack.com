/**
 * Re-export feed schema from convex (single source of truth)
 * This file exists to provide a convenient import path for frontend code
 */

// Re-export from convex feed schema
export {
  FEED_CATEGORIES,
  RELEASE_LEVELS,
  type FeedCategory,
  type ReleaseLevel,
} from '../../convex/feed/schema'

