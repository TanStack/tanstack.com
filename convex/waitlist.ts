import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const joinWaitlist = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existingEntry = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingEntry) {
      await ctx.db.patch(existingEntry._id, {
        requestedAt: Date.now(),
      });
      return { success: true, isUpdate: true };
    } else {
      await ctx.db.insert("waitlist", {
        email: args.email,
        requestedAt: Date.now(),
      });
      return { success: true, isUpdate: false };
    }
  },
});