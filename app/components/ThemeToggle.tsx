import { createServerFn } from '@tanstack/start'
import * as React from 'react'
import { FaMoon, FaSun } from 'react-icons/fa'
import { twMerge } from 'tailwind-merge'
import { getCookie, setCookie } from 'vinxi/http'
import { z } from 'zod'
import { create } from 'zustand'

const themeSchema = z.object({
  mode: z.enum(['light', 'dark', 'auto']),
  prefers: z.enum(['light', 'dark']),
})

type ThemeSchema = z.infer<typeof themeSchema>

interface ThemeStore {
  theme: ThemeSchema
  setPrefers: (prefers: ThemeSchema['prefers']) => void
  toggleMode: () => void
}

export type ThemeMode = z.infer<typeof themeSchema>['mode']

const updateThemeCookie = createServerFn({ method: 'POST' })
  .validator(themeSchema)
  .handler((ctx) => {
    setCookie('theme', JSON.stringify(ctx.data), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 10,
    })
  })

export const getThemeCookie = createServerFn().handler(() => {
  return themeSchema.parse(
    JSON.parse(getCookie('theme') ?? 'null') || {
      mode: 'auto',
      prefers: 'light',
    }
  )
})

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: {
    mode: 'auto',
    prefers: 'light',
  },
  setPrefers: (prefers) => {
    set((s) => {
      const newTheme = { ...s.theme, prefers }

      updateThemeCookie({
        data: newTheme,
      })

      updateThemeClass(newTheme)

      return {
        theme: newTheme,
      }
    })
  },
  toggleMode: () =>
    set((s) => {
      const newMode =
        s.theme.mode === 'auto'
          ? 'light'
          : s.theme.mode === 'light'
          ? 'dark'
          : 'auto'

      const newTheme: ThemeSchema = {
        mode: newMode,
        prefers: window.matchMedia('(prefers-color-scheme: dark)').matches
          ? ('dark' as const)
          : ('light' as const),
      }

      updateThemeClass(newTheme)
      updateThemeCookie({
        data: newTheme,
      })

      return {
        theme: newTheme,
      }
    }),
}))

if (typeof document !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (event) => {
      useThemeStore.getState().setPrefers(event.matches ? 'dark' : 'light')
    })
}

// Helper to update <body> class
function updateThemeClass(theme: ThemeSchema) {
  document.documentElement.classList.remove('dark')
  if (
    theme.mode === 'dark' ||
    (theme.mode === 'auto' && theme.prefers === 'dark')
  ) {
    document.documentElement.classList.add('dark')
  }
}

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.theme.mode)
  const toggleMode = useThemeStore((s) => s.toggleMode)

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
          className={twMerge(
            `text-sm transition-opacity`,
            mode !== 'auto' ? 'opacity-50' : 'opacity-0'
          )}
        />
        <FaMoon
          className={twMerge(
            `text-sm transition-opacity`,
            mode !== 'auto' ? 'opacity-50' : 'opacity-0'
          )}
        />
        <span
          className={twMerge(
            `uppercase select-none font-black text-[.6rem] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity`,
            mode === 'auto' ? 'opacity-30 hover:opacity-50' : 'opacity-0'
          )}
        >
          Auto
        </span>
      </div>
      <div
        className="absolute w-6 h-6 rounded-full shadow-md shadow-black/20 bg-white dark:bg-gray-400 transition-all duration-300 ease-in-out"
        style={{
          left: mode === 'auto' ? '50%' : mode === 'light' ? '100%' : '0%',
          transform: `translateX(${
            mode === 'auto' ? '-50%' : mode === 'light' ? '-100%' : '0'
          }) scale(${mode === 'auto' ? 0 : 0.8})`,
        }}
      />
    </div>
  )
}
