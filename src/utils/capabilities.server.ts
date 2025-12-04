import { db } from '~/db/client'
import { users, roles, roleAssignments } from '~/db/schema'
import { eq } from 'drizzle-orm'
import type { Capability } from '~/db/schema'

// Helper function to get effective capabilities (direct + role-based)
// Optimized to use single LEFT JOIN query to fetch both user and role capabilities
export async function getEffectiveCapabilities(
  userId: string
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
      (caps): caps is Capability[] => caps !== null && Array.isArray(caps)
    )
    .flat()

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
