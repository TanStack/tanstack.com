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
import type { AuthUser, Capability } from '~/auth/index.server'
import { ADMIN_ACCESS_CAPABILITIES } from '~/db/types'

// In local dev the codebase is open-source and env vars gate the actual
// secrets (DB, APIs). Route-level auth checks only block local workflows
// without adding security, so we skip them. Server function handlers that
// perform mutations are NOT bypassed here -- they enforce auth independently.
const IS_DEV = process.env.NODE_ENV === 'development'

// Synthetic dev user returned by UI-facing auth functions in local dev.
// Only used when IS_DEV -- never reaches production.
const DEV_USER: AuthUser = {
  userId: 'dev',
  email: 'dev@localhost',
  name: 'Dev User',
  image: null,
  oauthImage: null,
  displayUsername: 'dev',
  capabilities: ['admin'],
  adsDisabled: null,
  interestedInHidingAds: null,
  lastUsedFramework: null,
}

/**
 * Server function to get the current user.
 * Returns a synthetic dev user in local dev so the UI renders without a session.
 */
export const getCurrentUser = createServerFn({ method: 'POST' }).handler(
  async () => {
    if (IS_DEV) return DEV_USER
    const request = getRequest()
    const authService = getAuthService()
    return authService.getCurrentUser(request)
  },
)

/**
 * Server function to require authentication.
 * Called from route beforeLoad guards. Bypassed in local dev.
 * Do NOT use this inside server function handlers -- use guards directly.
 */
export const requireAuth = createServerFn({ method: 'POST' }).handler(
  async () => {
    if (IS_DEV) return DEV_USER
    const request = getRequest()
    const guards = getAuthGuards()
    return guards.requireAuth(request)
  },
)

/**
 * Server function to require a specific capability.
 * Called from route beforeLoad guards. Bypassed in local dev.
 * Do NOT use this inside server function handlers -- use guards directly.
 */
export const requireCapability = createServerFn({ method: 'POST' })
  .inputValidator((data: { capability: string }) => ({
    capability: data.capability as Capability,
  }))
  .handler(async ({ data: { capability } }) => {
    if (IS_DEV) return DEV_USER
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

/** @deprecated Import from ~/db/types instead */
export { ADMIN_ACCESS_CAPABILITIES as ADMIN_CAPABILITIES } from '~/db/types'

/**
 * Server function to require any admin-like capability.
 * Used for accessing the /admin area (each sub-route checks specific capabilities).
 * Bypassed in local dev -- route-level only, server fn handlers enforce independently.
 */
export const requireAnyAdminCapability = createServerFn({
  method: 'POST',
}).handler(async () => {
  if (IS_DEV) return DEV_USER

  const request = getRequest()
  const authService = getAuthService()
  const user = await authService.getCurrentUser(request)

  if (!user) {
    throw new Error('Not authenticated')
  }

  const hasAdminCapability = user.capabilities.some((cap) =>
    (ADMIN_ACCESS_CAPABILITIES as readonly string[]).includes(cap),
  )

  if (!hasAdminCapability) {
    throw new Error('Admin access required')
  }

  return user
})
