import { ScriptOnce } from '@tanstack/react-router'
import * as React from 'react'
import { FaMoon, FaSun } from 'react-icons/fa'
import { twMerge } from 'tailwind-merge'
import { z } from 'zod'
import { create } from 'zustand'

const resolvedThemeSchema = z.enum(['light', 'dark'])
const themeModeSchema = z.enum(['light', 'dark', 'auto'])
const themeKey = 'theme'

type ThemeMode = z.infer<typeof themeModeSchema>
type ResolvedTheme = z.infer<typeof resolvedThemeSchema>

interface ThemeStore {
  mode: ThemeMode
  toggleThemeMode: () => void
}

function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'
  try {
    const storedTheme = localStorage.getItem(themeKey)
    return resolvedThemeSchema.parse(storedTheme)
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

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: getStoredThemeMode(),
  toggleThemeMode: () =>
    set((s) => {
      const newMode =
        s.mode === 'auto' ? 'light' : s.mode === 'light' ? 'dark' : 'auto'

      updateThemeClass(newMode)
      setStoredThemeMode(newMode)

      return { mode: newMode }
    }),
}))

if (typeof document !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (useThemeStore.getState().mode === 'auto') {
        updateThemeClass('auto')
      }
    })
}

export function ThemeToggle() {
  const toggleMode = useThemeStore((s) => s.toggleThemeMode)

  const handleToggleMode = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    e.preventDefault()
    e.stopPropagation()
    toggleMode()
  }

  return (
    <div
      onClick={handleToggleMode}
      className={twMerge(
        `w-12 h-6 bg-gray-500/10 dark:bg-gray-800 rounded-full flex items-center justify-between cursor-pointer relative transition-all`
      )}
    >
      <div className="flex-1 flex items-center justify-between px-1.5">
        <FaSun
          className={`text-sm transition-opacity auto:opacity-0 opacity-50`}
        />
        <FaMoon
          className={`text-sm transition-opacity auto:opacity-0 opacity-50`}
        />
        <span
          className={`uppercase select-none font-black text-[.6rem] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity auto:opacity-30 auto:hover:opacity-50 opacity-0`}
        >
          Auto
        </span>
      </div>
      <div
        className="absolute w-6 h-6 rounded-full shadow-md shadow-black/20 bg-white dark:bg-gray-400 transition-all duration-300 ease-in-out
                   auto:left-1/2 auto:-translate-x-1/2 auto:scale-0 auto:opacity-0
                   light:left-full light:-translate-x-full light:scale-75 
                   dark:left-0 dark:translate-x-0 dark:scale-75"
      />
    </div>
  )
}

export function ThemeDetector() {
  return (
    <ScriptOnce
      children={(function () {
        function themeFn() {
          try {
            const storedTheme = localStorage.getItem('theme') || 'auto'

            if (storedTheme === 'auto') {
              const autoTheme = window.matchMedia(
                '(prefers-color-scheme: dark)'
              ).matches
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
      })()}
    />
  )
}
