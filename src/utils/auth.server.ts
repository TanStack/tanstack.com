import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getCurrentUserFromRequest } from './auth.server-helpers'
import type { Capability } from '~/db/schema'

// Re-export getCurrentUser for backward compatibility
export const getCurrentUser = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest()
    return getCurrentUserFromRequest(request)
  },
)

// Server function to require authentication
export const requireAuth = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest()
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      throw new Error('Not authenticated')
    }
    return user
  },
)

// Server function to require a specific capability
export const requireCapability = createServerFn({ method: 'POST' })
  .inputValidator((data: { capability: string }) => ({
    capability: data.capability as Capability,
  }))
  .handler(async ({ data: { capability } }) => {
    const request = getRequest()
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      throw new Error('Not authenticated')
    }
    // Admin users have access to everything
    const hasAccess =
      user.capabilities?.includes('admin') ||
      user.capabilities?.includes(capability)
    if (!hasAccess) {
      throw new Error(`Missing required capability: ${capability}`)
    }
    return user
  })

// Utility functions for use in loaders/beforeLoad
// These use server functions internally and work in both SSR and client contexts

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
 * Require authentication (throws redirect if not authenticated)
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
 * Require a specific capability (throws redirect if not authenticated or missing capability)
 * Can be called from loaders or beforeLoad
 */
export async function requireCapabilityUser(capability: string) {
  try {
    return await requireCapability({ data: { capability } })
  } catch {
    throw new Error(`Missing required capability: ${capability}`)
  }
}
