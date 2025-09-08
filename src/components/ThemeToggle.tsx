import * as React from 'react'
import { FaMoon, FaSun } from 'react-icons/fa'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { toggleMode } = useTheme()

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
      className={`bg-gray-500/10 dark:bg-gray-500/30 rounded-lg flex items-center justify-between
        hover:bg-gray-500/20 dark:hover:bg-gray-500/40
        cursor-pointer transition-all text-xs font-black`}
    >
      <div className="flex-1 flex items-center justify-between p-2 gap-1">
        <FaSun className={`hidden light:block`} />
        <FaMoon className={`hidden dark:block`} />
        <div
          className={`hidden auto:block uppercase select-none opacity-70 text-xs`}
        >
          Auto
        </div>
      </div>
    </div>
  )
}
