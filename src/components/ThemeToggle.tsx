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
      className={`bg-gray-500/20 rounded-lg flex items-center justify-between
        hover:bg-gray-500/30
        cursor-pointer transition-all duration-300 ease-in-out text-xs font-black`}
    >
      <div className="flex-1 flex items-center justify-between p-2 gap-1">
        <Sun className={`hidden light:block`} />
        <Moon className={`hidden dark:block`} />
        <div
          className={`hidden auto:block uppercase select-none opacity-70 text-xs`}
        >
          Auto
        </div>
      </div>
    </div>
  )
}
