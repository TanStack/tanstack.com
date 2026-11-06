/**
 * Isomorphic SHA-256 hashing utilities.
 * Works in both browser and Node.js environments using Web Crypto API.
 */

/**
 * Simple FNV-1a 32-bit hash fallback for environments where
 * crypto.subtle is unavailable (e.g. non-secure HTTP origins).
 * Returns a hex string like SHA-256 but shorter (8 chars).
 */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Compute SHA-256 hash of a string, returning hex-encoded result.
 * In browser contexts where crypto.subtle is unavailable (e.g. non-secure
 * HTTP origins), falls back to a simple FNV-1a hash so the page doesn't crash.
 * Server-side callers always have crypto.subtle available (Node.js 18+).
 */
export async function sha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && !crypto?.subtle) {
    return fnv1aHex(input)
  }
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
