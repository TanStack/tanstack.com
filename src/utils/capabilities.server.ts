import { db } from '~/db/client'
import { users, roles, roleAssignments } from '~/db/schema'
import { eq, inArray } from 'drizzle-orm'
import type { Capability } from '~/db/schema'

// Helper function to get effective capabilities (direct + role-based)
// Optimized to use single LEFT JOIN query to fetch both user and role capabilities
export async function getEffectiveCapabilities(
  userId: string,
): Promise<Capability[]> {
  // Single query to get both user capabilities and role capabilities
  const result = await db
    .select({
      userCapabilities: users.capabilities,
      roleCapabilities: roles.capabilities,
    })
    .from(users)
    .leftJoin(roleAssignments, eq(roleAssignments.userId, users.id))
    .leftJoin(roles, eq(roles.id, roleAssignments.roleId))
    .where(eq(users.id, userId))

  if (result.length === 0) {
    return []
  }

  // Extract user capabilities (same for all rows)
  const directCapabilities = result[0]?.userCapabilities || []

  // Collect all role capabilities from all rows
  const roleCapabilities = result
    .map((r) => r.roleCapabilities)
    .filter(
      (caps): caps is Capability[] => caps !== null && Array.isArray(caps),
    )
    .flat()

  // Union of direct capabilities and role capabilities
  const effectiveCapabilities = Array.from(
    new Set<Capability>([...directCapabilities, ...roleCapabilities]),
  )

  return effectiveCapabilities
}

// Bulk function to get effective capabilities for multiple users efficiently
// Uses a single query with LEFT JOINs to fetch all user and role capabilities at once
export async function getBulkEffectiveCapabilities(
  userIds: string[],
): Promise<Record<string, Capability[]>> {
  if (userIds.length === 0) {
    return {}
  }

  // Single query to get all user capabilities and role capabilities for all users
  const result = await db
    .select({
      userId: users.id,
      userCapabilities: users.capabilities,
      roleCapabilities: roles.capabilities,
    })
    .from(users)
    .leftJoin(roleAssignments, eq(roleAssignments.userId, users.id))
    .leftJoin(roles, eq(roles.id, roleAssignments.roleId))
    .where(inArray(users.id, userIds))

  // Group results by userId
  const userCapabilitiesMap: Record<string, Capability[]> = {}
  const userRoleCapabilitiesMap: Record<string, Capability[]> = {}

  for (const row of result) {
    const userId = row.userId

    // Store direct capabilities (same for all rows of the same user)
    if (!userCapabilitiesMap[userId]) {
      userCapabilitiesMap[userId] = row.userCapabilities || []
    }

    // Collect role capabilities
    if (row.roleCapabilities && Array.isArray(row.roleCapabilities)) {
      if (!userRoleCapabilitiesMap[userId]) {
        userRoleCapabilitiesMap[userId] = []
      }
      userRoleCapabilitiesMap[userId].push(...row.roleCapabilities)
    }
  }

  // Compute effective capabilities for each user
  const effectiveCapabilitiesMap: Record<string, Capability[]> = {}

  for (const userId of userIds) {
    const directCapabilities = userCapabilitiesMap[userId] || []
    const roleCapabilities = userRoleCapabilitiesMap[userId] || []

    // Union of direct capabilities and role capabilities
    const effectiveCapabilities = Array.from(
      new Set<Capability>([...directCapabilities, ...roleCapabilities]),
    )

    effectiveCapabilitiesMap[userId] = effectiveCapabilities
  }

  return effectiveCapabilitiesMap
}
