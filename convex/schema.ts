import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,
  users: defineTable({
    capabilities: v.array(v.string()),
  }),
  waitlist: defineTable({
    email: v.string(),
    requestedAt: v.number(),
  }).index("by_email", ["email"]),
});

export default schema