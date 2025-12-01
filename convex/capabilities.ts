import { QueryCtx } from './_generated/server'
import { Capability } from './schema'
import { Id } from './_generated/dataModel'

// Helper function to get effective capabilities (direct + role-based)
// Extracted to avoid circular dependencies between users.ts and roles.ts
export async function getEffectiveCapabilities(
  ctx: QueryCtx,
  userId: Id<'users'>
): Promise<Capability[]> {
  // Get user's direct capabilities
  const user = await ctx.db.get(userId)
  if (!user) {
    return []
  }
  const directCapabilities = user.capabilities || []

  // Get all role assignments for this user
  const roleAssignments = await ctx.db
    .query('roleAssignments')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()

  // Get all roles and their capabilities
  const roleIds = roleAssignments.map((ra) => ra.roleId)
  const roles = await Promise.all(roleIds.map((roleId) => ctx.db.get(roleId)))

  // Collect all capabilities from roles
  const roleCapabilities = roles
    .filter((role) => role !== null)
    .flatMap((role) => role!.capabilities || [])

  // Union of direct capabilities and role capabilities
  const effectiveCapabilities = Array.from(
    new Set<Capability>([...directCapabilities, ...roleCapabilities])
  )

  // Admin users automatically get feed capability
  if (effectiveCapabilities.includes('admin')) {
    effectiveCapabilities.push('feed')
  }

  // Return unique set (in case feed was already present)
  return Array.from(new Set<Capability>(effectiveCapabilities))
}
