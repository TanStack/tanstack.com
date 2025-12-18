/**
 * Auth Server Utilities
 *
 * This module delegates to the isolated auth module at ~/auth/
 * for backward compatibility with existing imports.
 *
 * For new code, import directly from '~/auth/index.server'.
 */

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getAuthService, getAuthGuards } from '~/auth/index.server'
import type { Capability } from '~/auth/index.server'

/**
 * Server function to get the current user
 */
export const getCurrentUser = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest()
    const authService = getAuthService()
    return authService.getCurrentUser(request)
  },
)

/**
 * Server function to require authentication
 */
export const requireAuth = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest()
    const guards = getAuthGuards()
    return guards.requireAuth(request)
  },
)

/**
 * Server function to require a specific capability
 */
export const requireCapability = createServerFn({ method: 'POST' })
  .inputValidator((data: { capability: string }) => ({
    capability: data.capability as Capability,
  }))
  .handler(async ({ data: { capability } }) => {
    const request = getRequest()
    const guards = getAuthGuards()
    return guards.requireCapability(request, capability)
  })

/**
 * Load user from session (non-blocking, returns null if not authenticated)
 * Can be called from loaders or beforeLoad
 */
export async function loadUser() {
  try {
    return await getCurrentUser()
  } catch {
    return null
  }
}

/**
 * Require authentication (throws if not authenticated)
 * Can be called from loaders or beforeLoad
 */
export async function requireAuthUser() {
  try {
    return await requireAuth()
  } catch {
    throw new Error('Not authenticated')
  }
}

/**
 * Require a specific capability (throws if not authorized)
 * Can be called from loaders or beforeLoad
 */
export async function requireCapabilityUser(capability: string) {
  try {
    return await requireCapability({ data: { capability } })
  } catch {
    throw new Error(`Missing required capability: ${capability}`)
  }
}
