import * as React from 'react'
import { useTheme } from './ThemeProvider'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { toggleMode } = useTheme()

  const handleToggleMode = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    toggleMode()
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      onClick={handleToggleMode}
      className={`bg-gray-500/10 dark:bg-gray-500/30 rounded-lg flex items-center justify-between
        hover:bg-gray-500/20 dark:hover:bg-gray-500/40
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
    </div>
  )
}
