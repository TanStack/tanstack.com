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
      className={`w-12 h-6 bg-gray-500/10 dark:bg-gray-800 rounded-full flex items-center justify-between cursor-pointer relative transition-all`}
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
                   left-0 translate-x-full scale-75
                   dark:left-0 dark:translate-x-0 dark:scale-75"
      />
    </div>
  )
}
