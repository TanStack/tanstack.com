import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { fetchSession } from '~/lib/auth-server-utils'

/**
 * Get the current authenticated user from Better Auth
 */
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getWebRequest()
    if (!request) {
      return { user: null, isAuthenticated: false }
    }

    const session = await fetchSession(request)

    return {
      user: session?.user || null,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user,
    }
  }
)

/**
 * Server function to check if the current user is authenticated
 */
export const checkUserAccess = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getWebRequest()
    if (!request) {
      return { allowed: false, reason: 'No request context' }
    }

    const session = await fetchSession(request)

    if (!session?.user) {
      return {
        allowed: false,
        reason: 'User not authenticated - please sign in',
        isAuthenticated: false,
      }
    }

    return {
      allowed: true,
      reason: 'User is authenticated',
      isAuthenticated: true,
      userId: session.user.id,
    }
  }
)

/**
 * Require authentication - redirects to login for unauthenticated users
 * Use this in route loaders or beforeLoad hooks for protected routes
 */
export const requireAuth = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getWebRequest()
    if (!request) {
      throw redirect({ to: '/login' })
    }

    const session = await fetchSession(request)

    if (!session?.user) {
      throw redirect({ to: '/login' })
    }

    return {
      user: session.user,
      userId: session.user.id,
      isAuthenticated: true,
      hasAccess: true,
    }
  }
)
