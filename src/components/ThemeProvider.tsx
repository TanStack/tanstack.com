import { ScriptOnce } from '@tanstack/react-router'
import { clientOnly, createIsomorphicFn } from '@tanstack/react-start'
import * as React from 'react'
import { createContext, ReactNode, useEffect, useState } from 'react'
import { z } from 'zod'

const themeModeSchema = z.enum(['light', 'dark', 'auto'])
const resolvedThemeSchema = z.enum(['light', 'dark'])
const themeKey = 'theme'

type ThemeMode = z.infer<typeof themeModeSchema>
type ResolvedTheme = z.infer<typeof resolvedThemeSchema>

const getStoredThemeMode = createIsomorphicFn()
  .server((): ThemeMode => 'auto')
  .client((): ThemeMode => {
    try {
      const storedTheme = localStorage.getItem(themeKey)
      return themeModeSchema.parse(storedTheme)
    } catch {
      return 'auto'
    }
  })

const setStoredThemeMode = clientOnly((theme: ThemeMode) => {
  try {
    const parsedTheme = themeModeSchema.parse(theme)
    localStorage.setItem(themeKey, parsedTheme)
  } catch {}
})

const getSystemTheme = createIsomorphicFn()
  .server((): ResolvedTheme => 'light')
  .client((): ResolvedTheme => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

const updateThemeClass = clientOnly((themeMode: ThemeMode) => {
  const root = document.documentElement
  root.classList.remove('light', 'dark', 'auto')
  const newTheme = themeMode === 'auto' ? getSystemTheme() : themeMode
  root.classList.add(newTheme)

  if (themeMode === 'auto') {
    root.classList.add('auto')
  }
})

const setupPreferredListener = clientOnly(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => updateThemeClass('auto')
  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
})

const getNextTheme = clientOnly((current: ThemeMode): ThemeMode => {
  const themes: ThemeMode[] =
    getSystemTheme() === 'dark'
      ? ['auto', 'light', 'dark']
      : ['auto', 'dark', 'light']
  return themes[(themes.indexOf(current) + 1) % themes.length]
})

const themeDetectorScript = (function () {
  function themeFn() {
    try {
      const storedTheme = localStorage.getItem('theme') || 'auto'
      const validTheme = ['light', 'dark', 'auto'].includes(storedTheme)
        ? storedTheme
        : 'auto'

      if (validTheme === 'auto') {
        const autoTheme = window.matchMedia('(prefers-color-scheme: dark)')
          .matches
          ? 'dark'
          : 'light'
        document.documentElement.classList.add(autoTheme, 'auto')
      } else {
        document.documentElement.classList.add(validTheme)
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
    if (themeMode !== 'auto') return
    return setupPreferredListener()
  }, [themeMode])

  const resolvedTheme = themeMode === 'auto' ? getSystemTheme() : themeMode

  const setTheme = (newTheme: ThemeMode) => {
    setThemeMode(newTheme)
    setStoredThemeMode(newTheme)
    updateThemeClass(newTheme)
  }

  const toggleMode = () => {
    setTheme(getNextTheme(themeMode))
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
