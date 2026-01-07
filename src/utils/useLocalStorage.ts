import { useState, useEffect } from 'react'

function getWithExpiry<T>(key: string): T | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  const itemStr = localStorage.getItem(key)
  if (!itemStr) {
    return undefined
  }

  try {
    const item: { value: T; ttl: number } = JSON.parse(itemStr)

    // If there is no TTL set, return the value
    if (!item.ttl) {
      return item.value
    }

    // If the item is expired, delete the item from storage
    if (new Date().getTime() > item.ttl) {
      localStorage.removeItem(key)
      return undefined
    }

    return item.value
  } catch {
    // If JSON parsing fails, remove the corrupted item and return undefined
    localStorage.removeItem(key)
    return undefined
  }
}

/**
 * React state that persists to `localStorage` (with optional TTL).
 *
 * - `key`: localStorage key to read/write
 * - `defaultValue`: initial value if no stored value
 * - `ttl` (ms): optional time-to-live; expired values are cleared and ignored
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  ttl?: number,
): [T, typeof setValue] {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const item = getWithExpiry<T>(key)
    if (item !== undefined) setValue(item)
  }, [key])

  useEffect(() => {
    localStorage.setItem(
      key,
      JSON.stringify({
        value,
        ttl: ttl ? new Date().getTime() + ttl : null,
      }),
    )
  }, [key, value, ttl])

  return [value, setValue]
}
