import * as React from 'react'
import { createStore } from '@tanstack/react-store'

/**
 * Creates a TanStack Store backed by `localStorage` that holds a value from a
 * fixed enum (e.g. `'vite' | 'rsbuild'`).
 *
 * Hydration is deferred to a `useEffect` to avoid SSR/CSR markup mismatches:
 * the server and the first client render both see `defaultValue`, then the
 * client swaps in the persisted value on mount.
 */
export function createPersistedEnumStore<TValue extends string>(options: {
  storageKey: string
  values: ReadonlyArray<TValue>
  defaultValue: TValue
}) {
  const { storageKey, values, defaultValue } = options

  const isValid = (candidate: string): candidate is TValue =>
    (values as ReadonlyArray<string>).includes(candidate)

  const store = createStore({ value: defaultValue }, ({ setState }) => ({
    setValue: (value: TValue) => {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, value)
        } catch {
          // Ignore quota / privacy-mode errors; in-memory state still updates.
        }
      }
      setState(() => ({ value }))
    },
  }))

  let hasHydrated = false

  function useHydrate() {
    React.useEffect(() => {
      if (hasHydrated) return
      hasHydrated = true
      if (typeof window === 'undefined') return
      try {
        const stored = window.localStorage.getItem(storageKey)
        if (stored && isValid(stored)) {
          store.setState(() => ({ value: stored }))
        }
      } catch {
        // Ignore storage access errors.
      }
    }, [])
  }

  return { store, useHydrate }
}
