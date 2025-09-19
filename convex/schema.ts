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
  }).searchIndex('search_email', {
    searchField: 'email',
  }),
  forge_projects: defineTable({
    userId: v.id('users'),
    name: v.string(),
    description: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),
  forge_chatMessages: defineTable({
    projectId: v.string(),
    messageId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_projectId', ['projectId'])
    .index('by_projectId_messageId', ['projectId', 'messageId']),
  forge_projectFiles: defineTable({
    projectId: v.string(),
    path: v.string(),
    content: v.string(),
  })
    .index('by_projectId_path', ['projectId', 'path'])
    .index('by_projectId', ['projectId']),
  llm_keys: defineTable({
    userId: v.id('users'),
    provider: v.string(), // e.g., 'openai', 'anthropic', 'google', 'mistral', etc.
    keyName: v.string(), // user-friendly name for the key
    apiKey: v.string(), // encrypted/hashed API key
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_provider', ['userId', 'provider']),
})

export default schema
