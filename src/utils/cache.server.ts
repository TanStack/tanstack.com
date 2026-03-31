import LRUCache from 'lru-cache'

declare global {
  var docCache: LRUCache<string, unknown>
  var docStaleCache: LRUCache<string, unknown>
}

const docCache =
  globalThis.docCache ||
  (globalThis.docCache = new LRUCache<string, unknown>({
    max: 300,
    // ttl: 1,
    ttl: process.env.NODE_ENV === 'production' ? 1 : 1000000,
  }))

const docStaleCache =
  globalThis.docStaleCache ||
  (globalThis.docStaleCache = new LRUCache<string, unknown>({
    max: 300,
  }))

export async function fetchCached<T>(opts: {
  fn: () => Promise<T>
  key: string
  ttl: number
  staleOnError?: boolean
}): Promise<T> {
  if (docCache.has(opts.key)) {
    return docCache.get(opts.key) as T
  }

  try {
    const result = await opts.fn()

    docCache.set(opts.key, result, {
      ttl: opts.ttl,
    })

    if (opts.staleOnError) {
      docStaleCache.set(opts.key, result)
    }

    return result
  } catch (error) {
    if (opts.staleOnError && docStaleCache.has(opts.key)) {
      console.warn(
        `[fetchCached] Serving stale value for key '${opts.key}' after fetch error`,
      )
      return docStaleCache.get(opts.key) as T
    }

    throw error
  }
}
