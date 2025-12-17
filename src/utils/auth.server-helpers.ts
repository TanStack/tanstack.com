import { getRequest } from '@tanstack/react-start/server'
import { db } from '~/db/client'
import { users } from '~/db/schema'
import { eq } from 'drizzle-orm'
import { getSessionCookie, verifyCookie } from './cookies.server'
import { getEffectiveCapabilities } from './capabilities.server'

// Helper to get user from session cookie (server-side only)
export async function getCurrentUserFromRequest(request: Request) {
  const signedCookie = getSessionCookie(request)

  if (!signedCookie) {
    // This is normal - user just isn't logged in
    return null
  }

  try {
    // Verify and parse the signed cookie
    const cookieData = await verifyCookie(signedCookie)

    if (!cookieData) {
      console.error('[AUTH:ERROR] Session cookie verification failed - invalid signature or expired')
      return null
    }

    // Query user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, cookieData.userId),
    })

    if (!user) {
      console.error(`[AUTH:ERROR] Session cookie references non-existent user ${cookieData.userId}`)
      return null
    }

    // Verify session version matches (for session revocation)
    if (user.sessionVersion !== cookieData.version) {
      console.error(`[AUTH:ERROR] Session version mismatch for user ${user.id} - expected ${user.sessionVersion}, got ${cookieData.version}`)
      return null
    }

    // Get effective capabilities (direct + role-based)
    const capabilities = await getEffectiveCapabilities(user.id)

    // Return user with capabilities
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      displayUsername: user.displayUsername,
      capabilities,
      adsDisabled: user.adsDisabled,
      interestedInHidingAds: user.interestedInHidingAds,
    }
  } catch (error) {
    console.error('[AUTH:ERROR] Failed to get user from session:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return null
  }
}

// Helper to get authenticated user from request (for use in server function wrappers)
// This uses getRequest() which is server-only, so this file should never be imported by client code
export async function getAuthenticatedUser() {
  const request = getRequest()
  const user = await getCurrentUserFromRequest(request)

  if (!user) {
    throw new Error('Not authenticated')
  }

  return user
}

// Helper to get session token from request (for use in server function wrappers)
// This uses getRequest() which is server-only, so this file should never be imported by client code
export function getSessionTokenFromRequest(): string {
  const request = getRequest()
  const token = getSessionToken(request)
  if (!token) {
    throw new Error('Not authenticated')
  }
  return token
}
