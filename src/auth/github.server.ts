/**
 * GitHub Auth Utilities
 *
 * Helper functions for checking GitHub OAuth scopes and tokens.
 */

import { env } from '~/utils/env'
import {
  buildGitHubAuthUrl,
  generateOAuthState,
  getOAuthAccountRepository,
} from './index.server'
import { readGitHubRepoScopeState } from './github-scopes'

/**
 * Check if a user has scope to create at least public repositories on GitHub.
 */
export async function hasGitHubRepoScope(userId: string): Promise<boolean> {
  const repo = getOAuthAccountRepository()
  const account = await repo.findByUserId(userId, 'github')
  return readGitHubRepoScopeState(account?.tokenScope).hasRepoScope
}

/**
 * Get a user's GitHub access token
 */
export async function getGitHubToken(userId: string): Promise<string | null> {
  const repo = getOAuthAccountRepository()
  const account = await repo.findByUserId(userId, 'github')
  return account?.accessToken ?? null
}

/**
 * Get a user's GitHub username from their access token
 */
export async function getGitHubUsername(
  accessToken: string,
): Promise<string | null> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'TanStack-Auth',
    },
  })

  if (!response.ok) return null

  const profile = await response.json()
  return profile.login ?? null
}

export interface GitHubAuthState {
  hasGitHubAccount: boolean
  hasPrivateRepoScope: boolean
  hasRepoScope: boolean
  accessToken: string | null
}

/**
 * Get complete GitHub auth state for a user
 */
export async function getGitHubAuthState(
  userId: string,
): Promise<GitHubAuthState> {
  const repo = getOAuthAccountRepository()
  const account = await repo.findByUserId(userId, 'github')

  if (!account) {
    return {
      hasGitHubAccount: false,
      hasPrivateRepoScope: false,
      hasRepoScope: false,
      accessToken: null,
    }
  }

  const scopeState = readGitHubRepoScopeState(account.tokenScope)

  return {
    hasGitHubAccount: true,
    hasPrivateRepoScope: scopeState.hasPrivateRepoScope,
    hasRepoScope: scopeState.hasRepoScope,
    accessToken: account.accessToken,
  }
}

/**
 * Build a GitHub re-auth URL with additional scopes
 */
export function buildGitHubReAuthUrl(
  returnTo: string,
  additionalScopes: Array<string>,
): string {
  const clientId = env.GITHUB_OAUTH_CLIENT_ID
  if (!clientId) {
    throw new Error('GITHUB_OAUTH_CLIENT_ID is not configured')
  }

  const origin = env.SITE_URL
  if (!origin) {
    throw new Error('SITE_URL is not configured')
  }

  const redirectUri = `${origin}/api/auth/callback/github`
  const state = generateOAuthState()

  // Build auth URL with additional scopes
  return buildGitHubAuthUrl(clientId, redirectUri, state, additionalScopes)
}
