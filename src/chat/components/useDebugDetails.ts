import { useSyncExternalStore } from 'react'

const key = 'gum.debug-details'
const changed = 'gum:debug-details'
let fallback = false
function read() {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return fallback
  }
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) notify()
  }
  window.addEventListener('storage', storage)
  window.addEventListener(changed, notify)
  return () => {
    window.removeEventListener('storage', storage)
    window.removeEventListener(changed, notify)
  }
}
export function useDebugDetails() {
  const enabled = useSyncExternalStore(subscribe, read, () => false)
  const setEnabled = (value: boolean) => {
    fallback = value
    try {
      localStorage.setItem(key, String(value))
    } catch {
      // Keep this page usable when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(changed))
  }
  return [enabled, setEnabled] as const
}
