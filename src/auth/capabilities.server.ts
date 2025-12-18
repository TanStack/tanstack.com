/**
 * Capabilities Service
 *
 * Handles authorization via capability-based access control.
 * Uses inversion of control for data access.
 */

import type { Capability, ICapabilitiesRepository, AuthUser } from './types'

// ============================================================================
// Capabilities Service
// ============================================================================

export class CapabilitiesService {
  constructor(private repository: ICapabilitiesRepository) {}

  /**
   * Get effective capabilities for a user (direct + role-based)
   */
  async getEffectiveCapabilities(userId: string): Promise<Capability[]> {
    return this.repository.getEffectiveCapabilities(userId)
  }

  /**
   * Get effective capabilities for multiple users efficiently
   */
  async getBulkEffectiveCapabilities(
    userIds: string[],
  ): Promise<Record<string, Capability[]>> {
    return this.repository.getBulkEffectiveCapabilities(userIds)
  }
}

// ============================================================================
// Capability Checking Utilities
// ============================================================================

/**
 * Check if user has a specific capability
 * Admin users have access to all capabilities
 */
export function hasCapability(
  capabilities: Capability[],
  requiredCapability: Capability,
): boolean {
  return (
    capabilities.includes('admin') || capabilities.includes(requiredCapability)
  )
}

/**
 * Check if user has all specified capabilities
 */
export function hasAllCapabilities(
  capabilities: Capability[],
  requiredCapabilities: Capability[],
): boolean {
  if (capabilities.includes('admin')) {
    return true
  }
  return requiredCapabilities.every((cap) => capabilities.includes(cap))
}

/**
 * Check if user has any of the specified capabilities
 */
export function hasAnyCapability(
  capabilities: Capability[],
  requiredCapabilities: Capability[],
): boolean {
  if (capabilities.includes('admin')) {
    return true
  }
  return requiredCapabilities.some((cap) => capabilities.includes(cap))
}

/**
 * Check if user is admin
 */
export function isAdmin(capabilities: Capability[]): boolean {
  return capabilities.includes('admin')
}

/**
 * Check if AuthUser has a specific capability
 */
export function userHasCapability(
  user: AuthUser | null | undefined,
  capability: Capability,
): boolean {
  if (!user) return false
  return hasCapability(user.capabilities, capability)
}

/**
 * Check if AuthUser is admin
 */
export function userIsAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  return isAdmin(user.capabilities)
}
