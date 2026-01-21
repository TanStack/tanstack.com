import { db } from '~/db/client'
import {
  oauthAuthorizationCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
} from '~/db/schema'
import { eq, and, sql, lt } from 'drizzle-orm'
import { sha256Hex } from '~/utils/hash'

// Token TTLs
const AUTH_CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Token prefixes (new generic prefixes)
const ACCESS_TOKEN_PREFIX = 'oa_'
const REFRESH_TOKEN_PREFIX = 'oar_'

// Legacy prefixes for backwards compatibility
const LEGACY_ACCESS_TOKEN_PREFIX = 'mcp_'
const LEGACY_REFRESH_TOKEN_PREFIX = 'mcpr_'

export type OAuthValidationResult =
  | {
      success: true
      tokenId: string
      userId: string
      clientId: string
    }
  | {
      success: false
      error: string
      status: number
    }

/**
 * Generate a secure random token with prefix
 */
export function generateToken(prefix: string): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return prefix + hex
}

/**
 * Hash a token using SHA-256
 */
export const hashToken = sha256Hex

/**
 * Validate redirect URI - must be localhost or HTTPS
 */
export function validateRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri)

    // Allow localhost (any port)
    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    ) {
      return true
    }

    // Allow HTTPS URLs
    if (url.protocol === 'https:') {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Verify PKCE code challenge
 * code_challenge = BASE64URL(SHA256(code_verifier))
 */
export async function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
): Promise<boolean> {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)

  // Base64URL encode
  const base64 = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  return base64 === codeChallenge
}

/**
 * Check if a token is an OAuth client token (new or legacy format)
 */
export function isOAuthClientToken(token: string): boolean {
  return (
    token.startsWith(ACCESS_TOKEN_PREFIX) ||
    token.startsWith(LEGACY_ACCESS_TOKEN_PREFIX)
  )
}

/**
 * Check if a token is an OAuth refresh token (new or legacy format)
 */
export function isOAuthRefreshToken(token: string): boolean {
  return (
    token.startsWith(REFRESH_TOKEN_PREFIX) ||
    token.startsWith(LEGACY_REFRESH_TOKEN_PREFIX)
  )
}

/**
 * Create an authorization code
 */
export async function createAuthorizationCode(params: {
  userId: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod?: string
  scope?: string
}): Promise<string> {
  const code = generateToken('')
  const codeHash = await hashToken(code)
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS)

  await db.insert(oauthAuthorizationCodes).values({
    codeHash,
    userId: params.userId,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod || 'S256',
    scope: params.scope || 'api',
    expiresAt,
  })

  return code
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeAuthorizationCode(params: {
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<
  | {
      success: true
      accessToken: string
      refreshToken: string
      expiresIn: number
      scope: string
    }
  | { success: false; error: string }
> {
  const codeHash = await hashToken(params.code)

  // Find and validate auth code
  const authCodes = await db
    .select()
    .from(oauthAuthorizationCodes)
    .where(eq(oauthAuthorizationCodes.codeHash, codeHash))
    .limit(1)

  const authCode = authCodes[0]

  if (!authCode) {
    return { success: false, error: 'invalid_grant' }
  }

  // Check expiration
  if (authCode.expiresAt < new Date()) {
    await db
      .delete(oauthAuthorizationCodes)
      .where(eq(oauthAuthorizationCodes.id, authCode.id))
    return { success: false, error: 'invalid_grant' }
  }

  // Validate redirect URI matches
  if (authCode.redirectUri !== params.redirectUri) {
    return { success: false, error: 'invalid_grant' }
  }

  // Verify PKCE
  const pkceValid = await verifyCodeChallenge(
    params.codeVerifier,
    authCode.codeChallenge,
  )
  if (!pkceValid) {
    return { success: false, error: 'invalid_grant' }
  }

  // Delete auth code (one-time use)
  await db
    .delete(oauthAuthorizationCodes)
    .where(eq(oauthAuthorizationCodes.id, authCode.id))

  // Generate tokens (using new prefixes)
  const accessToken = generateToken(ACCESS_TOKEN_PREFIX)
  const refreshToken = generateToken(REFRESH_TOKEN_PREFIX)
  const accessTokenHash = await hashToken(accessToken)
  const refreshTokenHash = await hashToken(refreshToken)

  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS)
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

  // Insert access token
  const accessTokenResult = await db
    .insert(oauthAccessTokens)
    .values({
      tokenHash: accessTokenHash,
      userId: authCode.userId,
      clientId: authCode.clientId,
      scope: authCode.scope,
      expiresAt: accessExpiresAt,
    })
    .returning({ id: oauthAccessTokens.id })

  // Insert refresh token
  await db.insert(oauthRefreshTokens).values({
    tokenHash: refreshTokenHash,
    userId: authCode.userId,
    clientId: authCode.clientId,
    accessTokenId: accessTokenResult[0].id,
    expiresAt: refreshExpiresAt,
  })

  return {
    success: true,
    accessToken,
    refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope: authCode.scope,
  }
}

/**
 * Refresh an access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<
  | {
      success: true
      accessToken: string
      expiresIn: number
      scope: string
    }
  | { success: false; error: string }
> {
  const tokenHash = await hashToken(refreshToken)

  // Find refresh token
  const refreshTokens = await db
    .select()
    .from(oauthRefreshTokens)
    .where(eq(oauthRefreshTokens.tokenHash, tokenHash))
    .limit(1)

  const token = refreshTokens[0]

  if (!token) {
    return { success: false, error: 'invalid_grant' }
  }

  // Check expiration
  if (token.expiresAt < new Date()) {
    await db
      .delete(oauthRefreshTokens)
      .where(eq(oauthRefreshTokens.id, token.id))
    return { success: false, error: 'invalid_grant' }
  }

  // Generate new access token (using new prefix)
  const accessToken = generateToken(ACCESS_TOKEN_PREFIX)
  const accessTokenHash = await hashToken(accessToken)
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS)

  // Insert new access token
  const accessTokenResult = await db
    .insert(oauthAccessTokens)
    .values({
      tokenHash: accessTokenHash,
      userId: token.userId,
      clientId: token.clientId,
      scope: 'api',
      expiresAt: accessExpiresAt,
    })
    .returning({ id: oauthAccessTokens.id })

  // Update refresh token to point to new access token
  await db
    .update(oauthRefreshTokens)
    .set({ accessTokenId: accessTokenResult[0].id })
    .where(eq(oauthRefreshTokens.id, token.id))

  return {
    success: true,
    accessToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope: 'api',
  }
}

/**
 * Validate an OAuth access token
 * Supports both new (oa_) and legacy (mcp_) token prefixes
 */
export async function validateOAuthToken(
  token: string,
): Promise<OAuthValidationResult> {
  const tokenHash = await hashToken(token)

  const result = await db
    .select({
      id: oauthAccessTokens.id,
      userId: oauthAccessTokens.userId,
      clientId: oauthAccessTokens.clientId,
      expiresAt: oauthAccessTokens.expiresAt,
    })
    .from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.tokenHash, tokenHash))
    .limit(1)

  const accessToken = result[0]

  if (!accessToken) {
    return {
      success: false,
      error: 'Invalid access token',
      status: 401,
    }
  }

  // Check expiration
  if (accessToken.expiresAt < new Date()) {
    return {
      success: false,
      error: 'Access token has expired',
      status: 401,
    }
  }

  // Update last used (fire and forget)
  db.update(oauthAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(oauthAccessTokens.id, accessToken.id))
    .catch(() => {})

  return {
    success: true,
    tokenId: accessToken.id,
    userId: accessToken.userId,
    clientId: accessToken.clientId,
  }
}

/**
 * List connected OAuth apps for a user
 * Uses refresh tokens since they persist longer than access tokens
 */
export async function listConnectedApps(userId: string): Promise<
  Array<{
    clientId: string
    createdAt: string
    lastUsedAt: string | null
  }>
> {
  // Get unique clients from refresh tokens (more persistent than access tokens)
  const result = await db
    .select({
      clientId: oauthRefreshTokens.clientId,
      createdAt: sql<string>`MIN(${oauthRefreshTokens.createdAt})::text`,
    })
    .from(oauthRefreshTokens)
    .where(eq(oauthRefreshTokens.userId, userId))
    .groupBy(oauthRefreshTokens.clientId)

  return result.map((r) => ({
    clientId: r.clientId,
    createdAt: r.createdAt,
    lastUsedAt: null,
  }))
}

/**
 * Revoke all tokens for a specific client
 */
export async function revokeTokensForClient(
  userId: string,
  clientId: string,
): Promise<void> {
  // Delete refresh tokens first (they reference access tokens)
  await db
    .delete(oauthRefreshTokens)
    .where(
      and(
        eq(oauthRefreshTokens.userId, userId),
        eq(oauthRefreshTokens.clientId, clientId),
      ),
    )

  // Delete access tokens
  await db
    .delete(oauthAccessTokens)
    .where(
      and(
        eq(oauthAccessTokens.userId, userId),
        eq(oauthAccessTokens.clientId, clientId),
      ),
    )
}

/**
 * Clean up expired tokens
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date()

  // Delete expired auth codes
  await db
    .delete(oauthAuthorizationCodes)
    .where(lt(oauthAuthorizationCodes.expiresAt, now))

  // Delete expired refresh tokens
  await db
    .delete(oauthRefreshTokens)
    .where(lt(oauthRefreshTokens.expiresAt, now))

  // Delete expired access tokens
  await db.delete(oauthAccessTokens).where(lt(oauthAccessTokens.expiresAt, now))
}
