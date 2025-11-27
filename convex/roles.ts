import { v } from 'convex/values'
import { mutation, query, QueryCtx } from './_generated/server'
import { Capability, CapabilitySchema } from './schema'
import { Id } from './_generated/dataModel'
import { requireCapability } from './users'
import { getEffectiveCapabilities } from './capabilities'

// Helper function to validate admin capability (reuses requireCapability)
async function requireAdmin(ctx: QueryCtx) {
  return await requireCapability(ctx, 'admin')
}

// List all roles (admin only)
export const listRoles = query({
  args: {
    nameFilter: v.optional(v.string()),
    capabilityFilter: v.optional(
      v.array(
        v.union(
          v.literal('admin'),
          v.literal('disableAds'),
          v.literal('builder')
        )
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Get all roles
    let roles = await ctx.db.query('roles').collect()

    // Apply name filter
    if (args.nameFilter && args.nameFilter.length > 0) {
      const nameLower = args.nameFilter.toLowerCase()
      roles = roles.filter(
        (role) =>
          role.name.toLowerCase().includes(nameLower) ||
          (role.description &&
            role.description.toLowerCase().includes(nameLower))
      )
    }

    // Apply capability filter
    if (args.capabilityFilter && args.capabilityFilter.length > 0) {
      roles = roles.filter((role) =>
        args.capabilityFilter!.some((cap) => role.capabilities.includes(cap))
      )
    }

    return roles.sort((a, b) => a.name.localeCompare(b.name))
  },
})

// Get a single role (admin only)
export const getRole = query({
  args: {
    roleId: v.id('roles'),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const role = await ctx.db.get(args.roleId)
    if (!role) {
      throw new Error('Role not found')
    }
    return role
  },
})

// Create a new role (admin only)
export const createRole = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    capabilities: v.array(
      v.union(v.literal('admin'), v.literal('disableAds'), v.literal('builder'))
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Check if role with same name already exists
    const existing = await ctx.db
      .query('roles')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .first()

    if (existing) {
      throw new Error(`Role with name "${args.name}" already exists`)
    }

    // Validate capabilities
    const validatedCapabilities = CapabilitySchema.array().parse(
      args.capabilities
    )

    const now = Date.now()
    const roleId = await ctx.db.insert('roles', {
      name: args.name,
      description: args.description,
      capabilities: validatedCapabilities,
      createdAt: now,
      updatedAt: now,
    })

    return { roleId, success: true }
  },
})

// Update a role (admin only)
export const updateRole = mutation({
  args: {
    roleId: v.id('roles'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    capabilities: v.optional(
      v.array(
        v.union(
          v.literal('admin'),
          v.literal('disableAds'),
          v.literal('builder')
        )
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const role = await ctx.db.get(args.roleId)
    if (!role) {
      throw new Error('Role not found')
    }

    // If name is being updated, check for duplicates
    if (args.name && args.name !== role.name) {
      const newName = args.name
      const existing = await ctx.db
        .query('roles')
        .withIndex('by_name', (q) => q.eq('name', newName))
        .first()

      if (existing) {
        throw new Error(`Role with name "${newName}" already exists`)
      }
    }

    const updates: Partial<typeof role> = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description
    if (args.capabilities !== undefined) {
      const validatedCapabilities = CapabilitySchema.array().parse(
        args.capabilities
      )
      updates.capabilities = validatedCapabilities
    }

    await ctx.db.patch(args.roleId, updates)

    return { success: true }
  },
})

// Delete a role (admin only)
export const deleteRole = mutation({
  args: {
    roleId: v.id('roles'),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const role = await ctx.db.get(args.roleId)
    if (!role) {
      throw new Error('Role not found')
    }

    // Delete all role assignments for this role
    const roleAssignments = await ctx.db
      .query('roleAssignments')
      .withIndex('by_role', (q) => q.eq('roleId', args.roleId))
      .collect()

    await Promise.all(roleAssignments.map((ra) => ctx.db.delete(ra._id)))

    // Delete the role
    await ctx.db.delete(args.roleId)

    return { success: true }
  },
})

// Get roles assigned to a user (admin only)
export const getUserRoles = query({
  args: {
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Return empty array if userId is not provided
    if (!args.userId) {
      return []
    }

    // Validate that user exists
    const user = await ctx.db.get(args.userId)
    if (!user) {
      return []
    }

    const roleAssignments = await ctx.db
      .query('roleAssignments')
      .withIndex('by_user', (q) => q.eq('userId', args.userId!))
      .collect()

    const roles = await Promise.all(
      roleAssignments.map((ra) => ctx.db.get(ra.roleId))
    )

    return roles.filter((role) => role !== null)
  },
})

// Assign roles to a user (admin only)
export const assignRolesToUser = mutation({
  args: {
    userId: v.id('users'),
    roleIds: v.array(v.id('roles')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Validate that user exists
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error('User not found')
    }

    // Validate that all roles exist
    const roles = await Promise.all(
      args.roleIds.map((roleId) => ctx.db.get(roleId))
    )
    if (roles.some((role) => role === null)) {
      throw new Error('One or more roles not found')
    }

    // Get existing role assignments
    const existingAssignments = await ctx.db
      .query('roleAssignments')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    const existingRoleIds = new Set(existingAssignments.map((ra) => ra.roleId))
    const newRoleIds = new Set(args.roleIds)

    // Delete assignments that are no longer needed
    const toDelete = existingAssignments.filter(
      (ra) => !newRoleIds.has(ra.roleId)
    )
    await Promise.all(toDelete.map((ra) => ctx.db.delete(ra._id)))

    // Create new assignments
    const toCreate = args.roleIds.filter(
      (roleId) => !existingRoleIds.has(roleId)
    )
    const now = Date.now()
    await Promise.all(
      toCreate.map((roleId) =>
        ctx.db.insert('roleAssignments', {
          userId: args.userId,
          roleId,
          createdAt: now,
        })
      )
    )

    return { success: true }
  },
})

// Get effective capabilities for a user (admin only)
export const getUserEffectiveCapabilities = query({
  args: {
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Return empty array if userId is not provided
    if (!args.userId) {
      return []
    }

    return await getEffectiveCapabilities(ctx, args.userId)
  },
})

// Bulk get roles for multiple users (admin only) - avoids N+1 queries
export const getBulkUserRoles = query({
  args: {
    userIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    if (args.userIds.length === 0) {
      return {}
    }

    // Get all role assignments for these users in one query
    const allAssignments = await ctx.db.query('roleAssignments').collect()

    // Filter to only assignments for our users
    const userIdsSet = new Set(args.userIds)
    const relevantAssignments = allAssignments.filter((ra) =>
      userIdsSet.has(ra.userId)
    )

    // Group by userId
    const rolesByUser: Record<
      string,
      Array<{ _id: string; name: string; capabilities: Capability[] }>
    > = {}

    // Initialize empty arrays
    args.userIds.forEach((userId) => {
      rolesByUser[userId] = []
    })

    // Get all unique role IDs
    const roleIds = Array.from(
      new Set(relevantAssignments.map((ra) => ra.roleId))
    )
    const roles = await Promise.all(roleIds.map((roleId) => ctx.db.get(roleId)))

    // Build map of roleId -> role
    const roleMap = new Map(
      roles.filter((r) => r !== null).map((r) => [r!._id, r!])
    )

    // Group assignments by user
    relevantAssignments.forEach((assignment) => {
      const role = roleMap.get(assignment.roleId)
      if (role) {
        rolesByUser[assignment.userId].push({
          _id: role._id,
          name: role.name,
          capabilities: role.capabilities,
        })
      }
    })

    return rolesByUser
  },
})

// Bulk get effective capabilities for multiple users (admin only) - avoids N+1 queries
export const getBulkEffectiveCapabilities = query({
  args: {
    userIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    if (args.userIds.length === 0) {
      return {}
    }

    // Get all users
    const users = await Promise.all(
      args.userIds.map((userId) => ctx.db.get(userId))
    )

    // Get all role assignments in one query
    const allAssignments = await ctx.db.query('roleAssignments').collect()

    const userIdsSet = new Set(args.userIds)
    const relevantAssignments = allAssignments.filter((ra) =>
      userIdsSet.has(ra.userId)
    )

    // Get all unique role IDs
    const roleIds = Array.from(
      new Set(relevantAssignments.map((ra) => ra.roleId))
    )
    const roles = await Promise.all(roleIds.map((roleId) => ctx.db.get(roleId)))

    // Build map of roleId -> role capabilities
    const roleCapabilitiesMap = new Map(
      roles
        .filter((r) => r !== null)
        .map((r) => [r!._id, r!.capabilities || []])
    )

    // Build result: userId -> effective capabilities
    const result: Record<string, Capability[]> = {}

    users.forEach((user) => {
      if (!user) return
      const directCapabilities = user.capabilities || []

      // Get role capabilities for this user
      const userAssignments = relevantAssignments.filter(
        (ra) => ra.userId === user._id
      )
      const roleCapabilities = userAssignments.flatMap(
        (ra) => roleCapabilitiesMap.get(ra.roleId) || []
      )

      // Union of direct + role capabilities
      result[user._id] = Array.from(
        new Set<Capability>([...directCapabilities, ...roleCapabilities])
      )
    })

    return result
  },
})

// Get all users with a specific role (admin only)
export const getUsersWithRole = query({
  args: {
    roleId: v.id('roles'),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Validate that role exists
    const role = await ctx.db.get(args.roleId)
    if (!role) {
      throw new Error('Role not found')
    }

    // Get all role assignments for this role
    const roleAssignments = await ctx.db
      .query('roleAssignments')
      .withIndex('by_role', (q) => q.eq('roleId', args.roleId))
      .collect()

    // Get all users
    const userIds = roleAssignments.map((ra) => ra.userId)
    const users = await Promise.all(userIds.map((userId) => ctx.db.get(userId)))

    return users.filter((user) => user !== null)
  },
})

// Remove users from a role (admin only)
export const removeUsersFromRole = mutation({
  args: {
    roleId: v.id('roles'),
    userIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Validate that role exists
    const role = await ctx.db.get(args.roleId)
    if (!role) {
      throw new Error('Role not found')
    }

    // Validate that all users exist
    const users = await Promise.all(
      args.userIds.map((userId) => ctx.db.get(userId))
    )
    if (users.some((user) => user === null)) {
      throw new Error('One or more users not found')
    }

    // Get role assignments to delete
    const roleAssignments = await ctx.db
      .query('roleAssignments')
      .withIndex('by_role', (q) => q.eq('roleId', args.roleId))
      .collect()

    const userIdsSet = new Set(args.userIds)
    const toDelete = roleAssignments.filter((ra) => userIdsSet.has(ra.userId))

    await Promise.all(toDelete.map((ra) => ctx.db.delete(ra._id)))

    return { success: true }
  },
})

// Bulk assign roles to multiple users (admin only)
export const bulkAssignRolesToUsers = mutation({
  args: {
    userIds: v.array(v.id('users')),
    roleIds: v.array(v.id('roles')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Validate that all users exist
    const users = await Promise.all(
      args.userIds.map((userId) => ctx.db.get(userId))
    )
    if (users.some((user) => user === null)) {
      throw new Error('One or more users not found')
    }

    // Validate that all roles exist
    const roles = await Promise.all(
      args.roleIds.map((roleId) => ctx.db.get(roleId))
    )
    if (roles.some((role) => role === null)) {
      throw new Error('One or more roles not found')
    }

    const now = Date.now()
    const assignmentsToCreate: Array<{
      userId: Id<'users'>
      roleId: Id<'roles'>
      createdAt: number
    }> = []

    // For each user, assign all roles (avoiding duplicates)
    for (const userId of args.userIds) {
      // Get existing assignments for this user
      const existingAssignments = await ctx.db
        .query('roleAssignments')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect()

      const existingRoleIds = new Set(
        existingAssignments.map((ra) => ra.roleId)
      )

      // Add new assignments for roles not already assigned
      for (const roleId of args.roleIds) {
        if (!existingRoleIds.has(roleId)) {
          assignmentsToCreate.push({
            userId,
            roleId,
            createdAt: now,
          })
        }
      }
    }

    // Insert all new assignments
    await Promise.all(
      assignmentsToCreate.map((assignment) =>
        ctx.db.insert('roleAssignments', assignment)
      )
    )

    return { success: true, assigned: assignmentsToCreate.length }
  },
})
