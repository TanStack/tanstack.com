import { createServerFn } from '@tanstack/react-start'
import { getAuth } from '@clerk/tanstack-start/server'
import { getWebRequest } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'

/**
 * Get the current authenticated user from Clerk
 */
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getWebRequest()
    if (!request) {
      return { user: null, isAuthenticated: false }
    }

    const { userId } = await getAuth(request)

    return {
      userId,
      isAuthenticated: !!userId,
    }
  }
)

/**
 * Server function to check if the current user is authenticated
 * In Clerk's waitlist mode, if a user can authenticate, they have been approved from the waitlist
 */
export const checkUserAccess = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getWebRequest()
    if (!request) {
      return { allowed: false, reason: 'No request context' }
    }

    const { userId } = await getAuth(request)

    if (!userId) {
      return {
        allowed: false,
        reason:
          'User not authenticated - please join waitlist or sign in if approved',
        isAuthenticated: false,
      }
    }

    // In waitlist mode, if user is authenticated via Clerk, they have been approved from the waitlist
    return {
      allowed: true,
      reason: 'User is authenticated and approved from waitlist',
      isAuthenticated: true,
      userId,
    }
  }
)

/**
 * Require authentication - redirects to waitlist for new users, login for approved users
 * Use this in route loaders or beforeLoad hooks for protected routes
 */
export const requireAuth = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getWebRequest()
    if (!request) {
      throw redirect({ to: '/login' })
    }

    const { userId } = await getAuth(request)

    if (!userId) {
      // In login mode, unauthenticated users should go to login
      throw redirect({ to: '/login' })
    }

    // In waitlist mode, authenticated users have been approved and have access
    return {
      userId,
      isAuthenticated: true,
      hasAccess: true,
    }
  }
)
