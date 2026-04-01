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
    deleteOnStale: false,
  }))

const pendingDocCache = new Map<string, Promise<unknown>>()

export function getCached<T>(key: string): T | undefined {
  if (!docCache.has(key)) {
    return undefined
  }

  return docCache.get(key) as T
}

export function getStaleCached<T>(key: string): T | undefined {
  return docCache.get(key, { allowStale: true }) as T | undefined
}

export async function fetchCachedWithStaleFallback<T>(opts: {
  fn: () => Promise<T>
  key: string
  ttl: number
  shouldFallbackToStale: (error: unknown) => boolean
  onStaleFallback?: (error: unknown) => void
}): Promise<T> {
  const cached = getCached<T>(opts.key)

  if (cached !== undefined) {
    return cached
  }

  const pending = pendingDocCache.get(opts.key)

  if (pending) {
    return pending as Promise<T>
  }

  const resultPromise = opts
    .fn()
    .then((result) => {
      docCache.set(opts.key, result, {
        ttl: opts.ttl,
      })

      return result
    })
    .catch((error) => {
      const stale = getStaleCached<T>(opts.key)

      if (stale !== undefined && opts.shouldFallbackToStale(error)) {
        opts.onStaleFallback?.(error)
        return stale
      }

      throw error
    })
    .finally(() => {
      pendingDocCache.delete(opts.key)
    })

  pendingDocCache.set(opts.key, resultPromise)

  return resultPromise
}

export async function fetchCached<T>(opts: {
  fn: () => Promise<T>
  key: string
  ttl: number
}): Promise<T> {
  if (docCache.has(opts.key)) {
    return docCache.get(opts.key) as T
  }

  const pending = pendingDocCache.get(opts.key)

  if (pending) {
    return pending as Promise<T>
  }

  const resultPromise = opts
    .fn()
    .then((result) => {
      docCache.set(opts.key, result, {
        ttl: opts.ttl,
      })

      return result
    })
    .finally(() => {
      pendingDocCache.delete(opts.key)
    })

  pendingDocCache.set(opts.key, resultPromise)

  return resultPromise
}
