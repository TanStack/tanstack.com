/**
 * Auth Server Helpers
 *
 * This module delegates to the isolated auth module at ~/auth/
 * for backward compatibility with existing imports.
 *
 * For new code, import directly from '~/auth/index.server'.
 */

import { getRequest } from '@tanstack/react-start/server'
import { getAuthService, getSessionService } from '~/auth/index.server'

/**
 * Get current user from request
 */
export async function getCurrentUserFromRequest(request: Request) {
  const authService = getAuthService()
  return authService.getCurrentUser(request)
}

/**
 * Get authenticated user from request (throws if not authenticated)
 */
export async function getAuthenticatedUser() {
  const request = getRequest()
  const authService = getAuthService()
  const user = await authService.getCurrentUser(request)

  if (!user) {
    throw new Error('Not authenticated')
  }

  return user
}

/**
 * Get session token from request
 */
export function getSessionTokenFromRequest(): string {
  const request = getRequest()
  const sessionService = getSessionService()
  const token = sessionService.getSessionCookie(request)
  if (!token) {
    throw new Error('Not authenticated')
  }
  return token
}
