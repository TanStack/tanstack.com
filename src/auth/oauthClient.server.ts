import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { timingSafeEqual } from 'node:crypto'
import { db } from '~/db/client'
import {
  oauthAuthorizationCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
  oauthAccounts,
} from '~/db/schema'
import { eq, and, sql, lt, isNull } from 'drizzle-orm'
import {
  authorizationGrant,
  SOURCE_CLIENT,
  SOURCE_CALLBACK,
} from './oauth-resources'
import { sha256Hex } from '~/utils/hash'
import { envFunctions } from '~/utils/env.functions'

// Token TTLs
const AUTH_CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Token prefixes (new generic prefixes)
const ACCESS_TOKEN_PREFIX = 'oa_'
const REFRESH_TOKEN_PREFIX = 'oar_'
const REGISTERED_CLIENT_PREFIX = 'tsr_'
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000
const MAX_REGISTERED_CLIENT_PAYLOAD_LENGTH = 8192

// Legacy prefixes for backwards compatibility
const LEGACY_ACCESS_TOKEN_PREFIX = 'mcp_'
const LEGACY_REFRESH_TOKEN_PREFIX = 'mcpr_'

export type OAuthValidationResult =
  | {
      success: true
      tokenId: string
      userId: string
      clientId: string
      scope: string
    }
  | {
      success: false
      error: string
      status: number
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is Array<string> {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function normalizeRedirectUri(uri: string): string | null {
  try {
    return new URL(uri).toString()
  } catch {
    return null
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value))
}

function base64UrlToString(value: string): string | null {
  try {
    const padded = value
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index)
    }
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

async function getOAuthClientSigningSecret() {
  const host = await getHostRuntimeEnv()
  const runtimeSecret = host?.SESSION_SECRET
  const secret =
    typeof runtimeSecret === 'string'
      ? runtimeSecret
      : envFunctions.SESSION_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required for OAuth client registration')
  }

  return secret ?? 'development-oauth-client-registration-secret'
}

async function signOAuthClientPayload(payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(await getOAuthClientSigningSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  )
  return bytesToBase64Url(new Uint8Array(signature))
}

function parseRegisteredClientPayload(
  value: unknown,
): { clientName: string; redirectUris: Array<string>; exact: boolean } | null {
  if (!isRecord(value)) return null

  const clientName = value.clientName
  const redirectUris = value.redirectUris
  if (typeof clientName !== 'string' || !isStringArray(redirectUris)) {
    return null
  }

  if (
    clientName.length > 100 ||
    redirectUris.length === 0 ||
    redirectUris.length > 10 ||
    redirectUris.join('').length > 4096 ||
    redirectUris.some((uri) => uri.length > 2048 || !validateRedirectUri(uri))
  ) {
    return null
  }

  return { clientName, redirectUris, exact: value.exact === true }
}

export async function createRegisteredClientId(params: {
  clientName: string
  redirectUris: Array<string>
}) {
  const payload = JSON.stringify({
    clientName: params.clientName,
    exact: true,
    redirectUris: params.redirectUris,
  })
  const encodedPayload = stringToBase64Url(payload)
  const signature = await signOAuthClientPayload(encodedPayload)

  return `${REGISTERED_CLIENT_PREFIX}${encodedPayload}.${signature}`
}

export async function validateOAuthClientRedirectUri(
  clientId: string,
  redirectUri: string,
) {
  if (clientId === SOURCE_CLIENT) return redirectUri === SOURCE_CALLBACK
  if (!clientId.startsWith(REGISTERED_CLIENT_PREFIX)) {
    return false
  }

  const body = clientId.slice(REGISTERED_CLIENT_PREFIX.length)
  const [encodedPayload, signature, extra] = body.split('.')
  if (
    !encodedPayload ||
    !signature ||
    extra !== undefined ||
    encodedPayload.length > MAX_REGISTERED_CLIENT_PAYLOAD_LENGTH
  ) {
    return false
  }

  const expectedSignature = await signOAuthClientPayload(encodedPayload)
  if (
    Buffer.byteLength(expectedSignature) !== Buffer.byteLength(signature) ||
    !timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
  ) {
    return false
  }

  const payloadText = base64UrlToString(encodedPayload)
  if (!payloadText) {
    return false
  }

  let payload: unknown
  try {
    payload = JSON.parse(payloadText)
  } catch {
    return false
  }

  const metadata = parseRegisteredClientPayload(payload)
  const normalizedRedirectUri = normalizeRedirectUri(redirectUri)
  return (
    !!metadata &&
    !!normalizedRedirectUri &&
    metadata.redirectUris.includes(
      metadata.exact ? redirectUri : normalizedRedirectUri,
    )
  )
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
    if (url.username || url.password || url.hash) {
      return false
    }

    // Allow localhost (any port)
    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    ) {
      return url.protocol === 'http:' || url.protocol === 'https:'
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
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) return false
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
  resource?: string
}): Promise<string> {
  if (
    !(await validateOAuthClientRedirectUri(params.clientId, params.redirectUri))
  ) {
    throw new Error('Client is not registered for this redirect URI')
  }

  if (
    params.codeChallengeMethod !== undefined &&
    params.codeChallengeMethod !== 'S256'
  )
    throw new Error('invalid_request')
  if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge))
    throw new Error('invalid_request')
  const grant = authorizationGrant(params.resource, params.scope)
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
    scope: grant.scope,
    resource: grant.resource,
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
  clientId?: string | null
  resource?: string | null
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

  // Atomically consume the authorization code before validation. Any exchange
  // attempt makes the code single-use, even when the verifier is wrong.
  const authCodes = await db
    .delete(oauthAuthorizationCodes)
    .where(eq(oauthAuthorizationCodes.codeHash, codeHash))
    .returning()

  const authCode = authCodes[0]

  if (!authCode) {
    return { success: false, error: 'invalid_grant' }
  }

  // Check expiration
  if (authCode.expiresAt < new Date()) {
    return { success: false, error: 'invalid_grant' }
  }

  if (
    (authCode.resource ?? null) !== (params.resource || null) ||
    (params.clientId && params.clientId !== authCode.clientId) ||
    (authCode.resource && !params.clientId)
  )
    return { success: false, error: 'invalid_grant' }

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

  // Generate tokens (using new prefixes)
  const accessToken = generateToken(ACCESS_TOKEN_PREFIX)
  const refreshToken = generateToken(REFRESH_TOKEN_PREFIX)
  const accessTokenHash = await hashToken(accessToken)
  const refreshTokenHash = await hashToken(refreshToken)

  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS)
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

  const grantId = crypto.randomUUID()
  // Insert access token
  const accessTokenResult = await db
    .insert(oauthAccessTokens)
    .values({
      tokenHash: accessTokenHash,
      userId: authCode.userId,
      clientId: authCode.clientId,
      scope: authCode.scope,
      resource: authCode.resource,
      grantId,
      expiresAt: accessExpiresAt,
    })
    .returning({ id: oauthAccessTokens.id })

  // Insert refresh token
  await db.insert(oauthRefreshTokens).values({
    tokenHash: refreshTokenHash,
    userId: authCode.userId,
    clientId: authCode.clientId,
    accessTokenId: accessTokenResult[0].id,
    scope: authCode.scope,
    resource: authCode.resource,
    grantId,
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
export async function refreshAccessToken(
  refreshToken: string,
  binding?: { clientId: string | null; resource: string | null },
): Promise<
  | {
      success: true
      accessToken: string
      refreshToken?: string
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

  if (
    (token.resource ?? null) !== (binding?.resource || null) ||
    (binding?.clientId && binding.clientId !== token.clientId) ||
    (token.resource && !binding?.clientId)
  )
    return { success: false, error: 'invalid_grant' }
  if (token.resource) return rotateResourceToken(tokenHash)

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
  resource: string | null = null,
): Promise<OAuthValidationResult> {
  const tokenHash = await hashToken(token)

  const result = await db
    .select({
      id: oauthAccessTokens.id,
      userId: oauthAccessTokens.userId,
      clientId: oauthAccessTokens.clientId,
      expiresAt: oauthAccessTokens.expiresAt,
      lastUsedAt: oauthAccessTokens.lastUsedAt,
      resource: oauthAccessTokens.resource,
      scope: oauthAccessTokens.scope,
    })
    .from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.tokenHash, tokenHash))
    .limit(1)

  const accessToken = result[0]

  const audienceMatches =
    accessToken &&
    ((accessToken.resource ?? null) === resource ||
      (resource === null &&
        accessToken.resource === 'https://tanstack.com/mcp'))
  if (!accessToken || !audienceMatches) {
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

  if (
    !accessToken.lastUsedAt ||
    Date.now() - accessToken.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS
  ) {
    db.update(oauthAccessTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(oauthAccessTokens.id, accessToken.id))
      .catch(() => {})
  }

  return {
    success: true,
    tokenId: accessToken.id,
    userId: accessToken.userId,
    clientId: accessToken.clientId,
    scope: accessToken.scope,
  }
}

/**
 * List connected OAuth apps for a user
 * Uses refresh tokens since they persist longer than access tokens
 */
export async function listConnectedApps(userId: string): Promise<
  Array<{
    clientId: string
    clientName: string
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
    clientName: oauthClientName(r.clientId),
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
  await db.transaction(async (tx) => {
    const grants = await tx
      .select({ grantId: oauthRefreshTokens.grantId })
      .from(oauthRefreshTokens)
      .where(
        and(
          eq(oauthRefreshTokens.userId, userId),
          eq(oauthRefreshTokens.clientId, clientId),
        ),
      )
    for (const grantId of [
      ...new Set(grants.map((g) => g.grantId).filter((g) => g !== null)),
    ].sort()) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${grantId}, 0))`,
      )
    }
    await tx
      .delete(oauthRefreshTokens)
      .where(
        and(
          eq(oauthRefreshTokens.userId, userId),
          eq(oauthRefreshTokens.clientId, clientId),
        ),
      )
    await tx
      .delete(oauthAccessTokens)
      .where(
        and(
          eq(oauthAccessTokens.userId, userId),
          eq(oauthAccessTokens.clientId, clientId),
        ),
      )
  })
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

// Row locking ensures a refresh token can only be consumed once, even by concurrent requests.
async function rotateResourceToken(tokenHash: string): Promise<
  | {
      success: true
      accessToken: string
      refreshToken: string
      scope: string
      expiresIn: number
    }
  | { success: false; error: string }
> {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ grantId: oauthRefreshTokens.grantId })
      .from(oauthRefreshTokens)
      .where(eq(oauthRefreshTokens.tokenHash, tokenHash))
      .limit(1)
    if (!candidate?.grantId) return { success: false, error: 'invalid_grant' }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${candidate.grantId}, 0))`,
    )
    const [token] = await tx
      .select()
      .from(oauthRefreshTokens)
      .where(eq(oauthRefreshTokens.tokenHash, tokenHash))
      .for('update')
    if (!token || !token.grantId)
      return { success: false, error: 'invalid_grant' }
    if (token.consumedAt || token.expiresAt <= new Date()) {
      await tx
        .delete(oauthAccessTokens)
        .where(eq(oauthAccessTokens.grantId, token.grantId))
      await tx
        .delete(oauthRefreshTokens)
        .where(eq(oauthRefreshTokens.grantId, token.grantId))
      return { success: false, error: 'invalid_grant' }
    }
    const accessToken = generateToken(ACCESS_TOKEN_PREFIX)
    const refreshToken = generateToken(REFRESH_TOKEN_PREFIX)
    await tx
      .update(oauthRefreshTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(oauthRefreshTokens.id, token.id),
          isNull(oauthRefreshTokens.consumedAt),
        ),
      )
    const [access] = await tx
      .insert(oauthAccessTokens)
      .values({
        tokenHash: await hashToken(accessToken),
        userId: token.userId,
        clientId: token.clientId,
        resource: token.resource,
        scope: token.scope,
        grantId: token.grantId,
        expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
      })
      .returning({ id: oauthAccessTokens.id })
    await tx.insert(oauthRefreshTokens).values({
      tokenHash: await hashToken(refreshToken),
      userId: token.userId,
      clientId: token.clientId,
      resource: token.resource,
      scope: token.scope,
      grantId: token.grantId,
      accessTokenId: access.id,
      expiresAt: token.expiresAt,
    })
    return {
      success: true,
      accessToken,
      refreshToken,
      scope: token.scope,
      expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
    }
  })
}

export async function introspectSourceToken(token: string) {
  const [row] = await db
    .select({
      sub: oauthAccessTokens.userId,
      aud: oauthAccessTokens.resource,
      scope: oauthAccessTokens.scope,
      exp: oauthAccessTokens.expiresAt,
      client_id: oauthAccessTokens.clientId,
    })
    .from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.tokenHash, await hashToken(token)))
    .limit(1)
  if (
    !row ||
    row.aud !== 'https://source.tanstack.com/mcp' ||
    row.exp <= new Date() ||
    row.scope !== 'source'
  )
    return { active: false }
  return {
    ...row,
    github_id: await verifiedGitHubIdentity(row.sub),
    active: true,
    iss: 'https://tanstack.com',
    exp: Math.floor(row.exp.getTime() / 1000),
  }
}

export async function revokeOAuthGrant(token: string, clientId: string) {
  const hash = await hashToken(token)
  const [access] = await db
    .select()
    .from(oauthAccessTokens)
    .where(
      and(
        eq(oauthAccessTokens.tokenHash, hash),
        eq(oauthAccessTokens.clientId, clientId),
      ),
    )
    .limit(1)
  const [refresh] = await db
    .select()
    .from(oauthRefreshTokens)
    .where(
      and(
        eq(oauthRefreshTokens.tokenHash, hash),
        eq(oauthRefreshTokens.clientId, clientId),
      ),
    )
    .limit(1)
  const grantId = access?.grantId ?? refresh?.grantId
  if (!grantId) return
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${grantId}, 0))`,
    )
    await tx
      .delete(oauthAccessTokens)
      .where(eq(oauthAccessTokens.grantId, grantId))
    await tx
      .delete(oauthRefreshTokens)
      .where(eq(oauthRefreshTokens.grantId, grantId))
  })
}

export async function authorizationClientName(
  clientId: string,
  redirectUri: string,
) {
  if (!(await validateOAuthClientRedirectUri(clientId, redirectUri)))
    throw new Error('invalid_client')
  if (clientId === SOURCE_CLIENT) return 'TanStack Source'
  const payload = base64UrlToString(
    clientId.slice(REGISTERED_CLIENT_PREFIX.length).split('.')[0],
  )
  const metadata = payload
    ? parseRegisteredClientPayload(JSON.parse(payload))
    : null
  return metadata?.clientName ?? 'OAuth client'
}

function oauthClientName(clientId: string) {
  if (clientId === SOURCE_CLIENT) return 'TanStack Source'
  try {
    const payload = base64UrlToString(
      clientId.slice(REGISTERED_CLIENT_PREFIX.length).split('.')[0],
    )
    const metadata = payload
      ? parseRegisteredClientPayload(JSON.parse(payload))
      : null
    return metadata?.clientName ?? clientId
  } catch {
    return clientId
  }
}

/** Only an unambiguous GitHub identity can automatically resolve an account in another product. */
export async function verifiedGitHubIdentity(userId: string) {
  const accounts = await db
    .select({ id: oauthAccounts.providerAccountId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.userId, userId),
        eq(oauthAccounts.provider, 'github'),
      ),
    )
    .limit(2)
  return accounts.length === 1 ? accounts[0].id : null
}
