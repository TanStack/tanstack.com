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
  }),
})

export default schema
