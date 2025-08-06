import { ScriptOnce } from '@tanstack/react-router'
import * as React from 'react'
import { createContext, ReactNode, useEffect, useState } from 'react'
import { z } from 'zod'

const themeModeSchema = z.enum(['light', 'dark', 'auto'])
const resolvedThemeSchema = z.enum(['light', 'dark'])
const themeKey = 'theme'

type ThemeMode = z.infer<typeof themeModeSchema>
type ResolvedTheme = z.infer<typeof resolvedThemeSchema>

function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'
  try {
    const storedTheme = localStorage.getItem(themeKey)
    return themeModeSchema.parse(storedTheme)
  } catch {
    return 'auto'
  }
}

function setStoredThemeMode(theme: ThemeMode): void {
  if (typeof window === 'undefined') return
  try {
    const parsedTheme = themeModeSchema.parse(theme)
    localStorage.setItem(themeKey, parsedTheme)
  } catch {}
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function updateThemeClass(themeMode: ThemeMode) {
  const root = document.documentElement
  root.classList.remove('light', 'dark', 'auto')
  const newTheme = themeMode === 'auto' ? getSystemTheme() : themeMode
  root.classList.add(newTheme)

  if (themeMode === 'auto') {
    root.classList.add('auto')
  }
}

function setupPreferredListener() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => updateThemeClass('auto')
  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}

const themeDetectorScript = (function () {
  function themeFn() {
    try {
      const storedTheme = localStorage.getItem('theme') || 'auto'

      if (storedTheme === 'auto') {
        const autoTheme = window.matchMedia('(prefers-color-scheme: dark)')
          .matches
          ? 'dark'
          : 'light'
        document.documentElement.classList.add(autoTheme, 'auto')
      } else {
        document.documentElement.classList.add(storedTheme)
      }
    } catch (e) {
      const autoTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'
      document.documentElement.classList.add(autoTheme, 'auto')
    }
  }
  return `(${themeFn.toString()})();`
})()

type ThemeContextProps = {
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeMode) => void
  toggleMode: () => void
}
const ThemeContext = createContext<ThemeContextProps | undefined>(undefined)

type ThemeProviderProps = {
  children: ReactNode
}
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode)

  useEffect(() => {
    updateThemeClass(themeMode)

    if (themeMode === 'auto') {
      return setupPreferredListener()
    }
  }, [themeMode])

  const resolvedTheme = themeMode === 'auto' ? getSystemTheme() : themeMode

  const setTheme = (newTheme: ThemeMode) => {
    setThemeMode(newTheme)
    setStoredThemeMode(newTheme)
  }

  const toggleMode = () => {
    setTheme(
      themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'auto' : 'light'
    )
  }

  return (
    <ThemeContext.Provider
      value={{ themeMode, resolvedTheme, setTheme, toggleMode }}
    >
      <ScriptOnce children={themeDetectorScript} />
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
