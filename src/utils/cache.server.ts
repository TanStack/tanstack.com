import { LRUCache } from 'lru-cache'

declare global {
  // @ts-expect-error - globalThis.docCache is set in the server entrypoint
  var docCache: LRUCache<string, unknown>
}

const docCache =
  globalThis.docCache ||
  // @ts-expect-error - globalThis.docCache is set in the server entrypoint
  (globalThis.docCache = new LRUCache<string, unknown>({
    max: 300,
    // ttl: 1,
    ttl: process.env.NODE_ENV === 'production' ? 1 : 1000000,
  }))

export async function fetchCached<T>(opts: {
  fn: () => Promise<T>
  key: string
  ttl: number
}): Promise<T> {
  if (docCache.has(opts.key)) {
    return docCache.get(opts.key) as T
  }

  const result = await opts.fn()

  docCache.set(opts.key, result, {
    ttl: opts.ttl,
  })

  return result
}
