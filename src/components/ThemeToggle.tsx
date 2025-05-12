import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import * as React from 'react'
import { FaMoon, FaSun } from 'react-icons/fa'
import { twMerge } from 'tailwind-merge'

import { z } from 'zod'
import { create } from 'zustand'

const themeModeSchema = z.enum(['light', 'dark', 'auto'])
const prefersModeSchema = z.enum(['light', 'dark'])

type ThemeMode = z.infer<typeof themeModeSchema>
type PrefersMode = z.infer<typeof prefersModeSchema>

interface ThemeStore {
  mode: ThemeMode
  prefers: PrefersMode
  toggleMode: () => void
  setPrefers: (prefers: PrefersMode) => void
}

const updateThemeCookie = createServerFn({ method: 'POST' })
  .validator(themeModeSchema)
  .handler((ctx) => {
    setCookie('theme', ctx.data, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 10,
    })
  })

export const getThemeCookie = createServerFn().handler(() => {
  return (
    themeModeSchema.catch('auto').parse(getCookie('theme') ?? 'null') || 'auto'
  )
})

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: 'auto',
  prefers: (() => {
    if (typeof document !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }

    return 'light'
  })(),
  toggleMode: () =>
    set((s) => {
      const newMode =
        s.mode === 'auto' ? 'light' : s.mode === 'light' ? 'dark' : 'auto'

      updateThemeClass(newMode, s.prefers)
      updateThemeCookie({
        data: newMode,
      })

      return {
        mode: newMode,
      }
    }),
  setPrefers: (prefers) => {
    set({ prefers })
    updateThemeClass(get().mode, prefers)
  },
}))

if (typeof document !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (event) => {
      if (useThemeStore.getState().mode === 'auto') {
      }
      useThemeStore.getState().setPrefers(event.matches ? 'dark' : 'light')
    })
}

// Helper to update <body> class
function updateThemeClass(mode: ThemeMode, prefers: PrefersMode) {
  document.documentElement.classList.remove('dark')
  if (mode === 'dark' || (mode === 'auto' && prefers === 'dark')) {
    document.documentElement.classList.add('dark')
  }
}

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode)
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
