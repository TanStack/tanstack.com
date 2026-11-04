import { useSyncExternalStore } from 'react'
import { isHomeSection, type HomeSection } from '../core/home-navigation'

const changed = 'gum:home-favorites'
const defaults = '["community"]'
const memory = new Map<string, string>()
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener(changed, notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener(changed, notify)
  }
}
export function useHomeFavorites(userId: string) {
  const key = `gum.home-favorites:${userId}`
  const read = () => {
    try {
      return localStorage.getItem(key) ?? memory.get(key) ?? defaults
    } catch {
      return memory.get(key) ?? defaults
    }
  }
  const value = useSyncExternalStore(subscribe, read, () => defaults)
  const parse = (raw: string): HomeSection[] => {
    try {
      const items: unknown = JSON.parse(raw)
      if (Array.isArray(items)) return [...new Set(items.filter(isHomeSection))]
    } catch {
      /* Ignore invalid saved preferences. */
    }
    return ['community']
  }
  const save = (items: HomeSection[]) => {
    const next = JSON.stringify(items)
    memory.set(key, next)
    try {
      localStorage.setItem(key, next)
    } catch {
      /* Keep the preference for this session. */
    }
    window.dispatchEvent(new Event(changed))
  }
  const toggle = (id: HomeSection) => {
    const current = parse(read())
    save(
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }
  const move = (id: HomeSection, index: number) => {
    const current = parse(read())
    if (!current.includes(id)) return
    const next = current.filter((item) => item !== id)
    next.splice(Math.max(0, Math.min(index, next.length)), 0, id)
    save(next)
  }
  return { favorites: parse(value), toggle, move }
}
