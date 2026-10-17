/**
 * A safe wrapper around crypto.randomUUID() that works in non-secure contexts
 * (e.g. HTTP) and older browsers that do not implement randomUUID.
 *
 * Falls back to crypto.getRandomValues when available, then to a
 * Date.now() + Math.random() string as a last resort.
 */
export function safeRandomUUID(): string {
  const c = globalThis.crypto

  if (c?.randomUUID) {
    return c.randomUUID()
  }

  if (c?.getRandomValues) {
    const values = new Uint32Array(4)
    c.getRandomValues(values)
    return Array.from(values, (v) => v.toString(16).padStart(8, '0')).join('-')
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
