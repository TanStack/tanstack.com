/**
 * OAuth Service
 *
 * Handles OAuth account management and user creation/linking.
 * Uses inversion of control for database access.
 */

import type {
  IOAuthService,
  IOAuthAccountRepository,
  IUserRepository,
  OAuthProfile,
  OAuthProvider,
  OAuthResult,
} from './types'
import { AuthError } from './types'

// ============================================================================
// OAuth Service Implementation
// ============================================================================

export class OAuthService implements IOAuthService {
  constructor(
    private oauthAccountRepository: IOAuthAccountRepository,
    private userRepository: IUserRepository,
  ) {}

  /**
   * Upsert OAuth account and associated user
   * - If OAuth account exists, updates user info and returns existing user
   * - If user with email exists, links OAuth account to existing user
   * - Otherwise, creates new user and OAuth account
   */
  async upsertOAuthAccount(
    provider: OAuthProvider,
    profile: OAuthProfile,
  ): Promise<OAuthResult> {
    try {
      // Check if OAuth account already exists
      const existingAccount =
        await this.oauthAccountRepository.findByProviderAndAccountId(
          provider,
          profile.id,
        )

      if (existingAccount) {
        // Account exists, update user info if needed
        const user = await this.userRepository.findById(existingAccount.userId)

        if (!user) {
          console.error(
            `[OAuthService] OAuth account exists for ${provider}:${profile.id} but user ${existingAccount.userId} not found`,
          )
          throw new AuthError(
            'User not found for existing OAuth account',
            'USER_NOT_FOUND',
          )
        }

        const updates: {
          email?: string
          name?: string
          image?: string
          updatedAt?: Date
        } = {}

        if (profile.email && user.email !== profile.email) {
          updates.email = profile.email
        }
        if (profile.name && user.name !== profile.name) {
          updates.name = profile.name
        }
        if (profile.image && user.image !== profile.image) {
          updates.image = profile.image
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date()
          await this.userRepository.update(existingAccount.userId, updates)
        }

        return {
          userId: existingAccount.userId,
          isNewUser: false,
        }
      }

      // Find user by email (for linking multiple OAuth providers)
      const existingUser = await this.userRepository.findByEmail(profile.email)

      let userId: string

      if (existingUser) {
        // Link OAuth account to existing user
        console.log(
          `[OAuthService] Linking ${provider} account to existing user ${existingUser.id} (${profile.email})`,
        )
        userId = existingUser.id

        // Update user info if provided and not already set
        const updates: {
          name?: string
          image?: string
          updatedAt?: Date
        } = {}

        if (profile.name && !existingUser.name) {
          updates.name = profile.name
        }
        if (profile.image && !existingUser.image) {
          updates.image = profile.image
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date()
          await this.userRepository.update(userId, updates)
        }
      } else {
        // Create new user
        console.log(
          `[OAuthService] Creating new user for ${provider} login: ${profile.email}`,
        )
        const newUser = await this.userRepository.create({
          email: profile.email,
          name: profile.name,
          image: profile.image,
          displayUsername: profile.name,
          capabilities: [],
        })

        userId = newUser.id
      }

      // Create OAuth account link
      await this.oauthAccountRepository.create({
        userId,
        provider,
        providerAccountId: profile.id,
        email: profile.email,
      })

      return {
        userId,
        isNewUser: !existingUser,
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }

      console.error(
        `[OAuthService] Failed to upsert OAuth account for ${provider}:${profile.id} (${profile.email}):`,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      )
      throw new AuthError(
        `OAuth account creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OAUTH_ERROR',
      )
    }
  }
}

// ============================================================================
// OAuth Provider Utilities
// ============================================================================

export interface OAuthConfig {
  clientId: string
  clientSecret: string
}

export interface GitHubOAuthConfig extends OAuthConfig {}
export interface GoogleOAuthConfig extends OAuthConfig {}

/**
 * Build GitHub OAuth authorization URL
 */
export function buildGitHubAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  return `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&scope=user:email&state=${state}`
}

/**
 * Build Google OAuth authorization URL
 */
export function buildGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=openid email profile&state=${state}`
}

/**
 * Exchange GitHub authorization code for access token
 */
export async function exchangeGitHubCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string> {
  const tokenResponse = await fetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    },
  )

  const tokenData = await tokenResponse.json()
  if (tokenData.error) {
    console.error(
      `[OAuth] GitHub token exchange failed: ${tokenData.error}, description: ${tokenData.error_description || 'none'}`,
    )
    throw new AuthError(`GitHub OAuth error: ${tokenData.error}`, 'OAUTH_ERROR')
  }

  if (!tokenData.access_token) {
    console.error(
      '[OAuth] GitHub token exchange succeeded but no access_token returned',
    )
    throw new AuthError('No access token received from GitHub', 'OAUTH_ERROR')
  }

  return tokenData.access_token
}

/**
 * Fetch GitHub user profile
 */
export async function fetchGitHubProfile(
  accessToken: string,
): Promise<OAuthProfile> {
  const profileResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  const profile = await profileResponse.json()

  // Fetch email (may require separate call)
  let email = profile.email
  if (!email) {
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
    const emails = await emailResponse.json()

    if (!Array.isArray(emails)) {
      console.error(
        `[OAuth] GitHub emails API returned non-array response:`,
        emails,
      )
      throw new AuthError(
        emails?.message || 'Failed to fetch GitHub emails',
        'OAUTH_ERROR',
      )
    }

    const primaryEmail = emails.find(
      (e: { primary: boolean; verified: boolean; email: string }) =>
        e.primary && e.verified,
    )
    const verifiedEmail = emails.find(
      (e: { verified: boolean; email: string }) => e.verified,
    )
    email = primaryEmail?.email || verifiedEmail?.email
  }

  if (!email) {
    console.error(
      `[OAuth] No verified email found for GitHub user ${profile.id} (${profile.login})`,
    )
    throw new AuthError(
      'No verified email found for GitHub account',
      'OAUTH_ERROR',
    )
  }

  return {
    id: String(profile.id),
    email,
    name: profile.name || profile.login,
    image: profile.avatar_url,
  }
}

/**
 * Exchange Google authorization code for access token
 */
export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string> {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenResponse.json()
  if (tokenData.error) {
    console.error(
      `[OAuth] Google token exchange failed: ${tokenData.error}, description: ${tokenData.error_description || 'none'}`,
    )
    throw new AuthError(`Google OAuth error: ${tokenData.error}`, 'OAUTH_ERROR')
  }

  if (!tokenData.access_token) {
    console.error(
      '[OAuth] Google token exchange succeeded but no access_token returned',
    )
    throw new AuthError('No access token received from Google', 'OAUTH_ERROR')
  }

  return tokenData.access_token
}

/**
 * Fetch Google user profile
 */
export async function fetchGoogleProfile(
  accessToken: string,
): Promise<OAuthProfile> {
  const profileResponse = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  const profile = await profileResponse.json()

  if (!profile.verified_email) {
    console.error(
      `[OAuth] Google email not verified for user ${profile.id} (${profile.email})`,
    )
    throw new AuthError('Google email not verified', 'OAUTH_ERROR')
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    image: profile.picture,
  }
}
