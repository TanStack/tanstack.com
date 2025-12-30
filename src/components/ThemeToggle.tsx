import * as React from 'react'
import { useTheme } from './ThemeProvider'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { themeMode, toggleMode } = useTheme()

  const handleToggleMode = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    toggleMode()
  }

  const label =
    themeMode === 'auto' ? 'Auto' : themeMode === 'light' ? 'Light' : 'Dark'

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      onClick={handleToggleMode}
      className={`flex items-center gap-1 rounded-md px-2 py-1.5
        border border-gray-200 dark:border-gray-700
        hover:bg-gray-100 dark:hover:bg-gray-800
        cursor-pointer transition-colors duration-200 text-xs font-medium`}
    >
      <Sun className={`w-3.5 h-3.5 hidden light:block`} />
      <Moon className={`w-3.5 h-3.5 hidden dark:block`} />
      <span>{label}</span>
    </div>
  )
}
