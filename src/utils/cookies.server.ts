// Cookie signing and verification utilities for stateless session management
// Uses HMAC-SHA256 to sign cookie data

// Get secret key from environment (fallback for dev)
function getSecretKey(): string {
  const secret =
    process.env.SESSION_SECRET || 'dev-secret-key-change-in-production'
  if (
    process.env.NODE_ENV === 'production' &&
    secret === 'dev-secret-key-change-in-production'
  ) {
    throw new Error('SESSION_SECRET must be set in production')
  }
  return secret
}

// Base64URL encoding/decoding utilities (works in all environments)
function base64UrlEncode(str: string): string {
  // Use btoa if available (browser/Node 18+), otherwise use TextEncoder + manual encoding
  if (typeof btoa !== 'undefined') {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  // Fallback: manual base64 encoding
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  const base64 = bytesToBase64(bytes)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlDecode(str: string): string {
  // Use atob if available (browser/Node 18+), otherwise use manual decoding
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/')

  if (typeof atob !== 'undefined') {
    return atob(normalized)
  }

  // Fallback: manual base64 decoding
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

// Cookie payload structure
export interface SessionCookieData {
  userId: string
  expiresAt: number // Unix timestamp in milliseconds
  version: number // sessionVersion from users table
}

// Sign cookie data using HMAC-SHA256
export async function signCookie(data: SessionCookieData): Promise<string> {
  const secret = getSecretKey()

  // Create payload: base64url(userId:expiresAt:version)
  const payload = `${data.userId}:${data.expiresAt}:${data.version}`
  const payloadBase64 = base64UrlEncode(payload)

  // Create HMAC signature
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
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
  // Convert Uint8Array to string efficiently (avoid spread operator for large arrays)
  let signatureStr = ''
  for (let i = 0; i < signatureArray.length; i++) {
    signatureStr += String.fromCharCode(signatureArray[i])
  }
  const signatureBase64 = base64UrlEncode(signatureStr)

  // Return: payload.signature
  return `${payloadBase64}.${signatureBase64}`
}

// Verify and parse signed cookie
export async function verifyCookie(
  signedCookie: string,
): Promise<SessionCookieData | null> {
  try {
    const secret = getSecretKey()
    const [payloadBase64, signatureBase64] = signedCookie.split('.')

    if (!payloadBase64 || !signatureBase64) {
      return null
    }

    // Verify signature
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(payloadBase64)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    // Decode signature
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

    // Decode payload
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
    console.error('[verifyCookie] Error verifying cookie:', error)
    return null
  }
}

// Read session cookie from request
export function getSessionCookie(request: Request): string | null {
  const cookies = request.headers.get('cookie') || ''
  const sessionCookie = cookies
    .split(';')
    .find((c) => c.trim().startsWith('session_token='))

  if (!sessionCookie) {
    return null
  }

  // Extract and decode the token value (handles URL-encoded values)
  const tokenValue = sessionCookie.split('=').slice(1).join('=').trim()
  const sessionToken = decodeURIComponent(tokenValue)
  return sessionToken || null
}
