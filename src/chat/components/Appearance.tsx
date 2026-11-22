import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react'
import type { ChatDocumentAppearance } from '../core/appearance-bootstrap'

declare global {
  interface Window {
    __TANCHAT_PRE_CHAT_APPEARANCE__?: ChatDocumentAppearance
  }
}
import {
  appearanceSchema,
  defaultAppearance,
  resolvePalette,
  type AppearancePreferences,
  type ThemePalette,
} from '../core/appearance'

const key = 'gum.appearance.settings'
const changed = 'gum:appearance'
const vars: Record<keyof ThemePalette, string> = {
  background: '--background',
  surface: '--surface',
  sidebar: '--sidebar',
  soft: '--soft',
  text: '--text',
  muted: '--muted',
  line: '--line',
  accent: '--accent',
  onAccent: '--on-accent',
}
type ServerAppearance = {
  userId: string
  settings: AppearancePreferences
  paint: { light: ThemePalette; dark: ThemePalette }
}
const serverAppearance = () =>
  (window as Window & { __GUM_SSR_APPEARANCE__?: ServerAppearance })
    .__GUM_SSR_APPEARANCE__
let lastRaw: string | null = null
let lastValue: AppearancePreferences = defaultAppearance
let initialized = false
function read(): AppearancePreferences {
  try {
    const raw = localStorage.getItem(key)
    if (!initialized) {
      initialized = true
      const server = serverAppearance()
      if (
        server &&
        localStorage.getItem(`gum.appearance.local-only.${server.userId}`) !==
          'true'
      ) {
        const parsed = appearanceSchema.safeParse(server.settings)
        if (parsed.success) {
          lastRaw = raw
          return (lastValue = parsed.data)
        }
      }
    }
    if (raw === lastRaw) return lastValue
    lastRaw = raw
    const parsed = appearanceSchema.safeParse(JSON.parse(raw || 'null'))
    if (parsed.success) return (lastValue = parsed.data)
    const old = localStorage.getItem('gum.appearance')
    return (lastValue =
      old === 'light' || old === 'dark'
        ? { ...defaultAppearance, mode: old }
        : defaultAppearance)
  } catch {
    return lastValue
  }
}
function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) notify()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(changed, notify)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(changed, notify)
  }
}
export function applyAppearance(value: AppearancePreferences) {
  const root = document.documentElement
  const mode =
    value.mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : value.mode
  const palette = resolvePalette(value, mode)
  root.dataset.appearance = mode
  root.dataset.appearanceChoice = value.mode
  root.style.colorScheme = mode
  for (const [name, css] of Object.entries(vars))
    root.style.setProperty(css, palette[name as keyof ThemePalette])
  root.style.setProperty(
    '--accent-hover',
    `color-mix(in srgb, ${palette.accent}, ${palette.text} 12%)`,
  )
  root.style.setProperty('--text', palette.text)
  root.style.color = palette.text
  root.style.background = palette.background
  for (const meta of document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )) {
    meta.removeAttribute('media')
    meta.content = palette.background
  }
}
export function setAppearanceSettings(value: AppearancePreferences) {
  const parsed = appearanceSchema.parse(value)
  applyAppearance(parsed)
  ;(
    window as Window & { __GUM_SSR_APPEARANCE__?: ServerAppearance }
  ).__GUM_SSR_APPEARANCE__ = undefined
  lastRaw = JSON.stringify(parsed)
  lastValue = parsed
  try {
    localStorage.setItem(key, lastRaw)
    localStorage.setItem('gum.appearance', parsed.mode)
    localStorage.setItem(
      'gum.appearance.paint',
      JSON.stringify({
        light: resolvePalette(parsed, 'light'),
        dark: resolvePalette(parsed, 'dark'),
      }),
    )
  } catch {}
  window.dispatchEvent(new Event(changed))
}
export function useAppearanceSettings() {
  const value = useSyncExternalStore(subscribe, read, () => defaultAppearance)
  return [value, setAppearanceSettings] as const
}
export function useAppearance() {
  const [value, setValue] = useAppearanceSettings()
  return [
    value.mode,
    (mode: AppearancePreferences['mode']) => setValue({ ...value, mode }),
  ] as const
}
export function AppearanceSync() {
  useLayoutEffect(() => {
    // Preserve the shared site's appearance when the chat route unmounts.
    const root = document.documentElement
    const properties = [
      ...Object.values(vars),
      '--accent-hover',
      'color-scheme',
      'color',
      'background',
    ]
    const bootstrapAppearance = window.__TANCHAT_PRE_CHAT_APPEARANCE__
    delete window.__TANCHAT_PRE_CHAT_APPEARANCE__
    const previous =
      bootstrapAppearance?.previous ??
      properties.map((name) => ({
        name,
        value: root.style.getPropertyValue(name),
        priority: root.style.getPropertyPriority(name),
      }))
    const appearance = bootstrapAppearance
      ? bootstrapAppearance.appearance
      : root.getAttribute('data-appearance')
    const choice = bootstrapAppearance
      ? bootstrapAppearance.choice
      : root.getAttribute('data-appearance-choice')
    const metas =
      bootstrapAppearance?.metas ??
      Array.from(
        document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
        (meta) => ({
          meta,
          content: meta.content,
          media: meta.getAttribute('media'),
        }),
      )
    return () => {
      for (const { name, value, priority } of previous) {
        if (value) root.style.setProperty(name, value, priority)
        else root.style.removeProperty(name)
      }
      if (appearance === null) root.removeAttribute('data-appearance')
      else root.setAttribute('data-appearance', appearance)
      if (choice === null) root.removeAttribute('data-appearance-choice')
      else root.setAttribute('data-appearance-choice', choice)
      for (const { meta, content, media } of metas) {
        meta.content = content
        if (media === null) meta.removeAttribute('media')
        else meta.setAttribute('media', media)
      }
    }
  }, [])
  useEffect(() => {
    const update = () => applyAppearance(read())
    update()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', update)
    const off = subscribe(update)
    return () => {
      media.removeEventListener('change', update)
      off()
    }
  }, [])
  return null
}
import { appearanceScript } from '../core/appearance-bootstrap'
export { appearanceScript }
