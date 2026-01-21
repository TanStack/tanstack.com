/**
 * Deploy Auth Hook
 *
 * Manages GitHub authentication state for the deploy flow.
 */

import { useState, useCallback, useEffect } from 'react'

interface DeployAuthState {
  isLoading: boolean
  authenticated: boolean
  hasGitHubAccount: boolean
  hasRepoScope: boolean
}

interface UseDeployAuthReturn extends DeployAuthState {
  refresh: () => Promise<void>
  redirectToGitHubAuth: () => void
}

async function fetchAuthStateFromServer(): Promise<DeployAuthState> {
  try {
    const response = await fetch('/api/builder/deploy/github')
    const data = await response.json()
    return {
      isLoading: false,
      authenticated: data.authenticated ?? false,
      hasGitHubAccount: data.hasGitHubAccount ?? false,
      hasRepoScope: data.hasRepoScope ?? false,
    }
  } catch {
    return {
      isLoading: false,
      authenticated: false,
      hasGitHubAccount: false,
      hasRepoScope: false,
    }
  }
}

export function useDeployAuth(): UseDeployAuthReturn {
  const [state, setState] = useState<DeployAuthState>({
    isLoading: true,
    authenticated: false,
    hasGitHubAccount: false,
    hasRepoScope: false,
  })

  const fetchAuthState = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }))
    const newState = await fetchAuthStateFromServer()
    setState(newState)
  }, [])

  // Fetch auth state on mount
  useEffect(() => {
    let cancelled = false
    fetchAuthStateFromServer().then((newState) => {
      if (!cancelled) {
        setState(newState)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const redirectToGitHubAuth = useCallback(() => {
    // Redirect to GitHub OAuth with public_repo scope
    // Include return URL so we can redirect back after auth
    const returnUrl = window.location.href
    const authUrl = `/auth/github/start?popup=false&scope=public_repo&returnTo=${encodeURIComponent(returnUrl)}`
    window.location.href = authUrl
  }, [])

  return {
    ...state,
    refresh: fetchAuthState,
    redirectToGitHubAuth,
  }
}
