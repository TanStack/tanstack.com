import { v } from 'convex/values'
import { mutation, query, QueryCtx } from './_generated/server'
import { getCurrentUserConvex } from './auth'
import { Id } from './_generated/dataModel'

import { encryptApiKey, decryptApiKey } from './encryption'

function formatKeyForDisplay(apiKey: string): string {
  if (apiKey.length <= 10) {
    return '*'.repeat(apiKey.length)
  }

  const firstFive = apiKey.substring(0, 5)
  const lastFive = apiKey.substring(apiKey.length - 5)
  const middleStars = '*'.repeat(Math.min(20, apiKey.length - 10))

  return `${firstFive}${middleStars}${lastFive}`
}

// Helper function to validate user authentication
async function requireAuthentication(ctx: QueryCtx) {
  const currentUser = await getCurrentUserConvex(ctx)
  if (!currentUser) {
    throw new Error('Not authenticated')
  }

  return { currentUser }
}

// Create a new LLM key for the current user
export const createMyLLMKey = mutation({
  args: {
    provider: v.string(),
    keyName: v.string(),
    apiKey: v.string(),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Validate user authentication
    const { currentUser } = await requireAuthentication(ctx)

    const now = Date.now()

    // Encrypt the API key before storing
    const encryptedApiKey = await encryptApiKey(args.apiKey)

    // Create the LLM key for the current user
    const keyId = await ctx.db.insert('llm_keys', {
      userId: currentUser.userId as Id<'users'>,
      provider: args.provider,
      keyName: args.keyName,
      apiKey: encryptedApiKey,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })

    return { success: true, keyId }
  },
})

// List LLM keys for the current user only (full keys for server use)
export const listMyLLMKeys = query({
  args: {},
  handler: async (ctx) => {
    // Validate user authentication
    const { currentUser } = await requireAuthentication(ctx)

    // Get all LLM keys for the current user
    const keys = await ctx.db
      .query('llm_keys')
      .withIndex('by_userId', (q) =>
        q.eq('userId', currentUser.userId as Id<'users'>)
      )
      .order('desc')
      .collect()

    // Decrypt the API keys and return the full keys (for server use)
    const decryptedKeys = await Promise.all(
      keys.map(async (key) => ({
        ...key,
        apiKey: await decryptApiKey(key.apiKey),
      }))
    )

    return decryptedKeys
  },
})

// List LLM keys for the current user with masked keys (for client display)
export const listMyLLMKeysForDisplay = query({
  args: {},
  handler: async (ctx) => {
    // Validate user authentication
    const { currentUser } = await requireAuthentication(ctx)

    // Get all LLM keys for the current user
    const keys = await ctx.db
      .query('llm_keys')
      .withIndex('by_userId', (q) =>
        q.eq('userId', currentUser.userId as Id<'users'>)
      )
      .order('desc')
      .collect()

    // Decrypt and format the API keys for display (first 5 + stars + last 5)
    const keysForDisplay = await Promise.all(
      keys.map(async (key) => {
        const decryptedKey = await decryptApiKey(key.apiKey)
        return {
          ...key,
          apiKey: formatKeyForDisplay(decryptedKey),
        }
      })
    )

    return keysForDisplay
  },
})

// Update an LLM key (only if it belongs to the current user)
export const updateMyLLMKey = mutation({
  args: {
    keyId: v.id('llm_keys'),
    provider: v.optional(v.string()),
    keyName: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Validate user authentication
    const { currentUser } = await requireAuthentication(ctx)

    // Validate that the key exists and belongs to the current user
    const existingKey = await ctx.db.get(args.keyId)
    if (!existingKey) {
      throw new Error('LLM key not found')
    }

    if (existingKey.userId !== (currentUser.userId as Id<'users'>)) {
      throw new Error('You can only update your own LLM keys')
    }

    // Prepare update object
    const updateData: any = {
      updatedAt: Date.now(),
    }

    if (args.provider !== undefined) updateData.provider = args.provider
    if (args.keyName !== undefined) updateData.keyName = args.keyName
    if (args.apiKey !== undefined)
      updateData.apiKey = await encryptApiKey(args.apiKey)
    if (args.isActive !== undefined) updateData.isActive = args.isActive

    // Update the LLM key
    await ctx.db.patch(args.keyId, updateData)

    return { success: true }
  },
})

// Delete an LLM key (only if it belongs to the current user)
export const deleteMyLLMKey = mutation({
  args: {
    keyId: v.id('llm_keys'),
  },
  handler: async (ctx, args) => {
    // Validate user authentication
    const { currentUser } = await requireAuthentication(ctx)

    // Validate that the key exists and belongs to the current user
    const existingKey = await ctx.db.get(args.keyId)
    if (!existingKey) {
      throw new Error('LLM key not found')
    }

    if (existingKey.userId !== (currentUser.userId as Id<'users'>)) {
      throw new Error('You can only delete your own LLM keys')
    }

    // Delete the LLM key
    await ctx.db.delete(args.keyId)

    return { success: true }
  },
})

// Toggle active status of an LLM key (only if it belongs to the current user)
export const toggleMyLLMKeyStatus = mutation({
  args: {
    keyId: v.id('llm_keys'),
  },
  handler: async (ctx, args) => {
    // Validate user authentication
    const { currentUser } = await requireAuthentication(ctx)

    // Validate that the key exists and belongs to the current user
    const existingKey = await ctx.db.get(args.keyId)
    if (!existingKey) {
      throw new Error('LLM key not found')
    }

    if (existingKey.userId !== (currentUser.userId as Id<'users'>)) {
      throw new Error('You can only toggle your own LLM keys')
    }

    // Toggle the active status
    await ctx.db.patch(args.keyId, {
      isActive: !existingKey.isActive,
      updatedAt: Date.now(),
    })

    return { success: true, newStatus: !existingKey.isActive }
  },
})
