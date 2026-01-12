/**
 * Capabilities Service
 *
 * Handles authorization via capability-based access control.
 * Uses inversion of control for data access.
 */

import type { ICapabilitiesRepository, AuthUser } from './types'
import {
  type Capability,
  hasCapability,
  hasAllCapabilities,
  hasAnyCapability,
  isAdmin,
} from '~/db/types'

// Re-export capability utilities from shared types for backwards compatibility
export { hasCapability, hasAllCapabilities, hasAnyCapability, isAdmin }

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
// AuthUser-specific Capability Utilities
// ============================================================================

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
