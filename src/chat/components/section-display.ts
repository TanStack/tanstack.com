import { useCallback, useSyncExternalStore } from 'react'
import type { SidebarDensity } from './bot-sidebar'

const changed = 'gum:section-display'
const fallback = new Map<string, string>()
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener(changed, notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener(changed, notify)
  }
}
export function useSectionDisplay(viewerId?: string) {
  const key = JSON.stringify(['gum', 'section-display', 1, viewerId])
  const read = useCallback(() => {
    try {
      return localStorage.getItem(key) ?? '{}'
    } catch {
      return fallback.get(key) ?? '{}'
    }
  }, [key])
  const raw = useSyncExternalStore(subscribe, read, () => '{}')
  let overrides: Record<string, SidebarDensity> = {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      overrides = Object.fromEntries(
        Object.entries(parsed)
          .filter(
            ([, value]) =>
              value === 'icons' ||
              value === 'comfortable' ||
              value === 'compact',
          )
          .map(([key, value]) => [
            key,
            value === 'icons' ? 'comfortable' : value,
          ]),
      ) as Record<string, SidebarDensity>
    }
  } catch {
    /* Ignore invalid saved preferences. */
  }
  const set = (group: string, value: SidebarDensity | 'default') => {
    let next: Record<string, SidebarDensity> = {}
    try {
      next = JSON.parse(read())
    } catch {
      /* Start fresh. */
    }
    if (!next || typeof next !== 'object' || Array.isArray(next)) next = {}
    if (value === 'default') delete next[group]
    else next[group] = value
    const serialized = JSON.stringify(next)
    fallback.set(key, serialized)
    try {
      localStorage.setItem(key, serialized)
    } catch {
      /* Keep session choice. */
    }
    window.dispatchEvent(new Event(changed))
  }
  return [overrides, set] as const
}
