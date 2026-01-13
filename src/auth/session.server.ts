/**
 * Session Management Module
 *
 * Handles cookie-based session management with HMAC-SHA256 signing.
 * This module is framework-agnostic and uses Web Crypto API.
 */

import type { SessionCookieData, ISessionService } from './types'

// ============================================================================
// Base64URL Utilities
// ============================================================================

function base64UrlEncode(str: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  const base64 = bytesToBase64(bytes)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlDecode(str: string): string {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/')

  if (typeof atob !== 'undefined') {
    return atob(normalized)
  }

  const bytes = base64ToBytes(normalized)
  const decoder = new TextDecoder()
  return decoder.decode(bytes)
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  let i = 0

  while (i < bytes.length) {
    const a = bytes[i++]
    const b = i < bytes.length ? bytes[i++] : 0
    const c = i < bytes.length ? bytes[i++] : 0

    const bitmap = (a << 16) | (b << 8) | c

    result += chars.charAt((bitmap >> 18) & 63)
    result += chars.charAt((bitmap >> 12) & 63)
    result += i - 2 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '='
    result += i - 1 < bytes.length ? chars.charAt(bitmap & 63) : '='
  }

  return result
}

function base64ToBytes(base64: string): Uint8Array {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Map<string, number>()
  for (let i = 0; i < chars.length; i++) {
    lookup.set(chars[i], i)
  }

  base64 = base64.replace(/=+$/, '')
  const bytes: number[] = []

  for (let i = 0; i < base64.length; i += 4) {
    const enc1 = lookup.get(base64[i]) ?? 0
    const enc2 = lookup.get(base64[i + 1]) ?? 0
    const enc3 = lookup.get(base64[i + 2]) ?? 0
    const enc4 = lookup.get(base64[i + 3]) ?? 0

    const bitmap = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4

    bytes.push((bitmap >> 16) & 255)
    if (enc3 !== 64) bytes.push((bitmap >> 8) & 255)
    if (enc4 !== 64) bytes.push(bitmap & 255)
  }

  return new Uint8Array(bytes)
}

// ============================================================================
// Session Service Implementation
// ============================================================================

export class SessionService implements ISessionService {
  private secret: string
  private isProduction: boolean

  constructor(secret: string, isProduction: boolean = false) {
    if (isProduction && secret === 'dev-secret-key-change-in-production') {
      throw new Error('SESSION_SECRET must be set in production')
    }
    this.secret = secret
    this.isProduction = isProduction
  }

  /**
   * Sign cookie data using HMAC-SHA256
   */
  async signCookie(data: SessionCookieData): Promise<string> {
    const payload = `${data.userId}:${data.expiresAt}:${data.version}`
    const payloadBase64 = base64UrlEncode(payload)

    const encoder = new TextEncoder()
    const keyData = encoder.encode(this.secret)
    const messageData = encoder.encode(payloadBase64)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const signature = await crypto.subtle.sign('HMAC', key, messageData)
    const signatureArray = new Uint8Array(signature)

    let signatureStr = ''
    for (let i = 0; i < signatureArray.length; i++) {
      signatureStr += String.fromCharCode(signatureArray[i])
    }
    const signatureBase64 = base64UrlEncode(signatureStr)

    return `${payloadBase64}.${signatureBase64}`
  }

  /**
   * Verify and parse signed cookie
   */
  async verifyCookie(signedCookie: string): Promise<SessionCookieData | null> {
    try {
      const [payloadBase64, signatureBase64] = signedCookie.split('.')

      if (!payloadBase64 || !signatureBase64) {
        return null
      }

      const encoder = new TextEncoder()
      const keyData = encoder.encode(this.secret)
      const messageData = encoder.encode(payloadBase64)

      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
      )

      const signatureStr = base64UrlDecode(signatureBase64)
      const signature = Uint8Array.from(signatureStr, (c) => c.charCodeAt(0))

      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        signature,
        messageData,
      )

      if (!isValid) {
        return null
      }

      const payload = base64UrlDecode(payloadBase64)
      const [userId, expiresAtStr, versionStr] = payload.split(':')

      if (!userId || !expiresAtStr || !versionStr) {
        return null
      }

      const expiresAt = parseInt(expiresAtStr, 10)
      const version = parseInt(versionStr, 10)

      // Check expiration
      if (Date.now() > expiresAt) {
        return null
      }

      return {
        userId,
        expiresAt,
        version,
      }
    } catch (error) {
      console.error(
        '[SessionService] Error verifying cookie:',
        error instanceof Error ? error.message : 'Unknown error',
      )
      return null
    }
  }

  /**
   * Read session cookie from request
   */
  getSessionCookie(request: Request): string | null {
    const cookies = request.headers.get('cookie') || ''
    const sessionCookie = cookies
      .split(';')
      .find((c) => c.trim().startsWith('session_token='))

    if (!sessionCookie) {
      return null
    }

    const tokenValue = sessionCookie.split('=').slice(1).join('=').trim()
    const sessionToken = decodeURIComponent(tokenValue)
    return sessionToken || null
  }

  /**
   * Create session cookie header value
   */
  createSessionCookieHeader(signedCookie: string, maxAge: number): string {
    return `session_token=${encodeURIComponent(signedCookie)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${this.isProduction ? '; Secure' : ''}`
  }

  /**
   * Create clear session cookie header value
   */
  createClearSessionCookieHeader(): string {
    return `session_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${this.isProduction ? '; Secure' : ''}`
  }
}

// ============================================================================
// OAuth State Cookie Utilities
// ============================================================================

export function generateOAuthState(): string {
  const stateBytes = new Uint8Array(16)
  crypto.getRandomValues(stateBytes)
  const base64 = btoa(String.fromCharCode(...stateBytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function createOAuthStateCookie(
  state: string,
  isProduction: boolean,
): string {
  // Use SameSite=Strict for OAuth state to prevent CSRF during OAuth flow
  return `oauth_state=${encodeURIComponent(state)}; HttpOnly; Path=/; Max-Age=${10 * 60}; SameSite=Strict${isProduction ? '; Secure' : ''}`
}

export function clearOAuthStateCookie(isProduction: boolean): string {
  return `oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${isProduction ? '; Secure' : ''}`
}

export function getOAuthStateCookie(request: Request): string | null {
  const cookies = request.headers.get('cookie') || ''
  const stateCookie = cookies
    .split(';')
    .find((c) => c.trim().startsWith('oauth_state='))

  if (!stateCookie) {
    return null
  }

  return decodeURIComponent(stateCookie.split('=').slice(1).join('=').trim())
}

export function createOAuthPopupCookie(isProduction: boolean): string {
  return `oauth_popup=1; HttpOnly; Path=/; Max-Age=${10 * 60}; SameSite=Lax${isProduction ? '; Secure' : ''}`
}

export function clearOAuthPopupCookie(isProduction: boolean): string {
  return `oauth_popup=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProduction ? '; Secure' : ''}`
}

export function isOAuthPopupMode(request: Request): boolean {
  const cookies = request.headers.get('cookie') || ''
  return cookies.split(';').some((c) => c.trim().startsWith('oauth_popup=1'))
}

// ============================================================================
// Session Constants
// ============================================================================

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days
