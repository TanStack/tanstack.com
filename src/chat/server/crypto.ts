export async function hash(value: string) {
  return b64(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
}
export function b64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}
function unb64(value: string) {
  return Uint8Array.from(
    atob(value.replaceAll('-', '+').replaceAll('_', '/')),
    (c) => c.charCodeAt(0),
  )
}
async function key(secret: string) {
  if (!secret || secret.length < 32)
    throw new Error('Server encryption is not configured.')
  return crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  )
}
export async function seal(value: unknown, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(secret),
    new TextEncoder().encode(JSON.stringify(value)),
  )
  return `${b64(iv)}.${b64(new Uint8Array(encrypted))}`
}
export async function unseal<T>(value: string, secret: string): Promise<T> {
  const [iv, data] = value.split('.')
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) },
    await key(secret),
    unb64(data),
  )
  return JSON.parse(new TextDecoder().decode(raw)) as T
}

/** Stable RFC 9562 UUIDv8 for application operations, not a random credential. */
export async function stableOperationId(parts: readonly unknown[]) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(parts)),
    ),
  )
  bytes[6] = (bytes[6] & 15) | 128
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes.slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
