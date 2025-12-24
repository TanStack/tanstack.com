/**
 * Auth Module Types
 *
 * This file defines the core types and interfaces for the authentication module.
 * These types are designed to be framework-agnostic and can be used by both
 * server and client code.
 */

// ============================================================================
// Capability Types
// ============================================================================

export type Capability =
  | 'admin'
  | 'disableAds'
  | 'builder'
  | 'feed'
  | 'moderate-feedback'

export const VALID_CAPABILITIES: readonly Capability[] = [
  'admin',
  'disableAds',
  'builder',
  'feed',
  'moderate-feedback',
] as const

// ============================================================================
// OAuth Types
// ============================================================================

export type OAuthProvider = 'github' | 'google'

export interface OAuthProfile {
  id: string
  email: string
  name?: string
  image?: string
}

export interface OAuthResult {
  userId: string
  isNewUser: boolean
}

// ============================================================================
// Session Types
// ============================================================================

export interface SessionCookieData {
  userId: string
  expiresAt: number // Unix timestamp in milliseconds
  version: number // sessionVersion from users table for revocation
}

// ============================================================================
// User Types
// ============================================================================

/**
 * Authenticated user data returned from session validation
 */
export interface AuthUser {
  userId: string
  email: string
  name: string | null
  image: string | null
  displayUsername: string | null
  capabilities: Capability[]
  adsDisabled: boolean | null
  interestedInHidingAds: boolean | null
  lastUsedFramework: string | null
}

/**
 * Database user record (used by data access layer)
 */
export interface DbUser {
  id: string
  email: string
  name: string | null
  image: string | null
  displayUsername: string | null
  capabilities: Capability[]
  adsDisabled: boolean | null
  interestedInHidingAds: boolean | null
  lastUsedFramework: string | null
  sessionVersion: number
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Data Access Interfaces (for Inversion of Control)
// ============================================================================

/**
 * User repository interface for database operations
 * Implement this interface to inject database access into the auth module
 */
export interface IUserRepository {
  findById(userId: string): Promise<DbUser | null>
  findByEmail(email: string): Promise<DbUser | null>
  create(data: {
    email: string
    name?: string
    image?: string
    displayUsername?: string
    capabilities?: Capability[]
  }): Promise<DbUser>
  update(
    userId: string,
    data: Partial<{
      email: string
      name: string
      image: string
      displayUsername: string
      capabilities: Capability[]
      adsDisabled: boolean
      interestedInHidingAds: boolean
      lastUsedFramework: string
      sessionVersion: number
      updatedAt: Date
    }>,
  ): Promise<void>
  incrementSessionVersion(userId: string): Promise<void>
}

/**
 * OAuth account repository interface
 */
export interface IOAuthAccountRepository {
  findByProviderAndAccountId(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<{ userId: string } | null>
  create(data: {
    userId: string
    provider: OAuthProvider
    providerAccountId: string
    email: string
  }): Promise<void>
}

/**
 * Capabilities repository interface
 */
export interface ICapabilitiesRepository {
  getEffectiveCapabilities(userId: string): Promise<Capability[]>
  getBulkEffectiveCapabilities(
    userIds: string[],
  ): Promise<Record<string, Capability[]>>
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * Session service interface for cookie-based session management
 */
export interface ISessionService {
  signCookie(data: SessionCookieData): Promise<string>
  verifyCookie(signedCookie: string): Promise<SessionCookieData | null>
  getSessionCookie(request: Request): string | null
  createSessionCookieHeader(signedCookie: string, maxAge: number): string
  createClearSessionCookieHeader(): string
}

/**
 * Auth service interface for user authentication
 */
export interface IAuthService {
  getCurrentUser(request: Request): Promise<AuthUser | null>
  validateSession(
    sessionData: SessionCookieData,
  ): Promise<{ user: DbUser; capabilities: Capability[] } | null>
}

/**
 * OAuth service interface for OAuth operations
 */
export interface IOAuthService {
  upsertOAuthAccount(
    provider: OAuthProvider,
    profile: OAuthProfile,
  ): Promise<OAuthResult>
}

// ============================================================================
// Auth Context (Dependency Injection Container)
// ============================================================================

/**
 * Auth context contains all dependencies required by the auth module
 * Use this to inject implementations at runtime
 */
export interface AuthContext {
  userRepository: IUserRepository
  oauthAccountRepository: IOAuthAccountRepository
  capabilitiesRepository: ICapabilitiesRepository
  sessionSecret: string
  isProduction: boolean
}

// ============================================================================
// Error Types
// ============================================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public code: AuthErrorCode,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export type AuthErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'MISSING_CAPABILITY'
  | 'INVALID_SESSION'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'USER_NOT_FOUND'
  | 'OAUTH_ERROR'
