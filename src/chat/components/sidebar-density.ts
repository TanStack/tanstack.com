import { useCallback, useSyncExternalStore } from 'react'
import { sidebarDensityKey, type SidebarDensity } from './bot-sidebar'

export { sidebarDensityKey, type SidebarDensity } from './bot-sidebar'

const values = new Map<string | null, SidebarDensity>()
const sessionOnly = new Set<string | null>()
const listeners = new Map<string | null, Set<() => void>>()
let listening = false

function readStorage(key: string | null) {
  if (typeof window === 'undefined') return 'comfortable' as const
  try {
    const stored = key && window.localStorage.getItem(key)
    return stored === 'compact' ? stored : 'comfortable'
  } catch {
    return values.get(key) ?? 'comfortable'
  }
}

function emit(key: string | null) {
  listeners.get(key)?.forEach((listener) => listener())
}

function onStorage(event: StorageEvent) {
  // Other storage areas do not carry the device's sidebar preference.
  try {
    if (event.storageArea && event.storageArea !== window.localStorage) return
  } catch {
    return
  }
  const keys = event.key === null ? [...values.keys()] : [event.key]
  for (const key of keys) {
    if (!values.has(key) && !listeners.has(key)) continue
    sessionOnly.delete(key)
    values.set(key, readStorage(key))
    emit(key)
  }
}

export function readSidebarDensity(viewerId?: string): SidebarDensity {
  if (typeof window === 'undefined') return 'comfortable'
  const key = sidebarDensityKey(viewerId)
  if (!values.has(key)) values.set(key, readStorage(key))
  return values.get(key)!
}

export function setSidebarDensity(
  viewerId: string | undefined,
  value: SidebarDensity,
) {
  const key = sidebarDensityKey(viewerId)
  values.set(key, value)
  let persisted = false
  try {
    if (key && typeof window !== 'undefined') {
      window.localStorage.setItem(key, value)
      persisted = true
    }
  } catch {
    /* The current session still receives the selected layout. */
  }
  if (persisted) sessionOnly.delete(key)
  else sessionOnly.add(key)
  emit(key)
  return persisted
}

export function subscribeSidebarDensity(
  viewerId: string | undefined,
  listener: () => void,
) {
  const key = sidebarDensityKey(viewerId)
  const callbacks = listeners.get(key) ?? new Set<() => void>()
  callbacks.add(listener)
  listeners.set(key, callbacks)
  if (typeof window !== 'undefined') {
    // Catch cross-tab changes that happened while no subscriber was mounted.
    // An in-session choice survives a blocked storage write until a real storage event.
    if (!sessionOnly.has(key)) values.set(key, readStorage(key))
    if (!listening) {
      window.addEventListener('storage', onStorage)
      listening = true
    }
  }
  return () => {
    callbacks.delete(listener)
    if (!callbacks.size) listeners.delete(key)
    if (listening && !listeners.size) {
      window.removeEventListener('storage', onStorage)
      listening = false
    }
  }
}

export function useSidebarDensity(viewerId?: string) {
  const subscribe = useCallback(
    (listener: () => void) => subscribeSidebarDensity(viewerId, listener),
    [viewerId],
  )
  const getSnapshot = useCallback(
    () => readSidebarDensity(viewerId),
    [viewerId],
  )
  const value = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => 'comfortable' as const,
  )
  const set = useCallback(
    (next: SidebarDensity) => setSidebarDensity(viewerId, next),
    [viewerId],
  )
  return [value, set] as const
}
