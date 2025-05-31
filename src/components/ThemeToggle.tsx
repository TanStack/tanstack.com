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
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    toggleMode()
  }

  return (
    <div
      onClick={handleToggleMode}
      className={twMerge(
        `relative flex h-6 w-12 cursor-pointer items-center justify-between rounded-full bg-gray-500/10 transition-all dark:bg-gray-800`,
      )}
    >
      <div className="flex flex-1 items-center justify-between px-1.5">
        <FaSun
          className={twMerge(
            `text-sm transition-opacity`,
            mode !== 'auto' ? 'opacity-50' : 'opacity-0',
          )}
        />
        <FaMoon
          className={twMerge(
            `text-sm transition-opacity`,
            mode !== 'auto' ? 'opacity-50' : 'opacity-0',
          )}
        />
        <span
          className={twMerge(
            `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[.6rem] font-black uppercase transition-opacity select-none`,
            mode === 'auto' ? 'opacity-30 hover:opacity-50' : 'opacity-0',
          )}
        >
          Auto
        </span>
      </div>
      <div
        className="absolute h-6 w-6 rounded-full bg-white shadow-md shadow-black/20 transition-all duration-300 ease-in-out dark:bg-gray-400"
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
