/**
 * Auth Client Module
 *
 * Client-side authentication utilities and navigation helpers.
 * This module is safe to import in browser code.
 */

import type { OAuthProvider } from './types'

// ============================================================================
// Auth Client
// ============================================================================

/**
 * Client-side auth utilities for OAuth flows
 */
export const authClient = {
  signIn: {
    /**
     * Initiate OAuth sign-in with a social provider (full page redirect)
     */
    social: ({ provider }: { provider: OAuthProvider }) => {
      window.location.href = `/auth/${provider}/start`
    },

    /**
     * Initiate OAuth sign-in in a popup window (for modal-based login)
     */
    socialPopup: ({ provider }: { provider: OAuthProvider }) => {
      const width = 500
      const height = 600
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      window.open(
        `/auth/${provider}/start?popup=true`,
        'tanstack-oauth',
        `width=${width},height=${height},left=${left},top=${top},popup=yes`,
      )
    },
  },

  /**
   * Sign out the current user
   */
  signOut: async () => {
    window.location.href = '/auth/signout'
  },
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigate to sign-in page
 */
export function navigateToSignIn(
  provider?: OAuthProvider,
  returnTo?: string,
): void {
  if (provider) {
    const url = returnTo
      ? `/auth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`
      : `/auth/${provider}/start`
    window.location.href = url
  } else {
    const url = returnTo
      ? `/login?returnTo=${encodeURIComponent(returnTo)}`
      : '/login'
    window.location.href = url
  }
}

/**
 * Navigate to sign-out
 */
export function navigateToSignOut(): void {
  window.location.href = '/auth/signout'
}

/**
 * Get current URL path for return-to parameter
 */
export function getCurrentPath(): string {
  return window.location.pathname + window.location.search
}
