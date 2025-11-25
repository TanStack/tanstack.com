import { defineSchema, defineTable } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { z } from 'zod'

// Zod schema for valid capabilities
// Valid capabilities list (exported for use throughout the app)
export const VALID_CAPABILITIES = ['admin', 'disableAds', 'builder'] as const
export const CapabilitySchema = z.enum(VALID_CAPABILITIES)
export type Capability = z.infer<typeof CapabilitySchema>

// Helper function to validate a capability
export function validateCapability(
  capability: string
): capability is Capability {
  return VALID_CAPABILITIES.includes(capability as Capability)
}

// Valid capabilities for Convex validation
const validCapabilities = VALID_CAPABILITIES

const schema = defineSchema({
  ...authTables,
  users: defineTable({
    displayUsername: v.optional(v.string()),
    createdAt: v.number(),
    image: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.string(),
    updatedAt: v.number(),
    capabilities: v.array(
      v.union(...validCapabilities.map((cap) => v.literal(cap)))
    ),
    adsDisabled: v.optional(v.boolean()),
    interestedInHidingAds: v.optional(v.boolean()),
  }).searchIndex('search_email', {
    searchField: 'email',
  }),
  // .index('by_email', ['email']),
  feedEntries: defineTable({
    // Identity
    id: v.string(), // Unique identifier (e.g., "github:tanstack/query:v5.0.0" or UUID for manual)
    source: v.string(), // Source identifier (e.g., "github", "blog", "tweet")
    // Content
    title: v.string(),
    content: v.string(), // Markdown content
    excerpt: v.optional(v.string()), // Auto-generated or manual
    // Metadata
    publishedAt: v.number(), // Timestamp
    createdAt: v.number(),
    updatedAt: v.number(),
    // Source-specific metadata (JSON blob for debugging, not used in business logic)
    metadata: v.optional(v.any()),
    // Categorization
    libraryIds: v.array(v.string()), // Library IDs (e.g., ['query', 'router'])
    partnerIds: v.optional(v.array(v.string())), // Partner IDs if applicable
    tags: v.array(v.string()), // Custom tags (e.g., ['announcement', 'breaking-change', 'release:patch'])
    category: v.union(
      v.literal('release'),
      v.literal('announcement'),
      v.literal('blog'),
      v.literal('partner'),
      v.literal('update'),
      v.literal('other')
    ),
    // Display control
    isVisible: v.boolean(), // Can hide entries without deleting
    priority: v.optional(v.number()), // Unified priority level (higher = more prominent)
    featured: v.optional(v.boolean()), // Featured entries
    // Auto-sync metadata
    autoSynced: v.boolean(), // Whether this was auto-created
    lastSyncedAt: v.optional(v.number()), // Last sync timestamp
  })
    .index('by_published', ['publishedAt'])
    .index('by_source', ['source'])
    .index('by_category', ['category'])
    // Note: libraryIds is an array, so we can't index it directly
    // Filtering is done in-memory in queries.ts
    .index('by_visible', ['isVisible', 'publishedAt'])
    .searchIndex('search_content', {
      searchField: 'title',
    }),
  feedConfig: defineTable({
    key: v.string(), // e.g., 'defaultFilters'
    value: v.any(), // JSON value
    updatedAt: v.number(),
  }).index('by_key', ['key']),
})

export default schema
