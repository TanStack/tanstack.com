import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Application users table - your custom user data
  users: defineTable({
    email: v.string(),
    // Custom fields for your app
    adsDisabled: v.optional(v.boolean()),
  }).index('email', ['email']),
})
