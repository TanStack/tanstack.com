import * as React from 'react'
import { useTheme } from './ThemeProvider'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { toggleMode } = useTheme()

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleMode()
      }}
      aria-label="Toggle color theme"
      className={`bg-gray-500/10 dark:bg-gray-500/30 rounded-lg flex items-center justify-between
        hover:bg-gray-500/20 dark:hover:bg-gray-500/40
        focus:ring-2 focus:ring-offset-2 focus:ring-gray-500/50 dark:focus:ring-gray-400/50
        cursor-pointer transition-all duration-300 ease-in-out text-xs font-black`}
    >
      <div className="flex-1 flex items-center justify-between p-1.5 gap-1">
        <Sun className={`hidden light:block`} size={16} />
        <Moon className={`hidden dark:block`} size={16} />
        <div
          className={`hidden auto:block uppercase select-none opacity-70 text-xs`}
        >
          Auto
        </div>
      </div>
    </button>
  )
}
