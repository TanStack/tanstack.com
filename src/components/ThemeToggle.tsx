import * as React from 'react'
import { useTheme } from './ThemeProvider'
import { Moon, Sun, SunMoon } from 'lucide-react'
import { Button } from '~/ui'

export function ThemeToggle() {
  const { themeMode, toggleMode } = useTheme()

  const handleToggleMode = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    toggleMode()
  }

  const label =
    themeMode === 'auto' ? 'Auto' : themeMode === 'light' ? 'Light' : 'Dark'

  return (
    <Button variant="ghost" size="xs" onClick={handleToggleMode}>
      {themeMode === 'auto' ? (
        <SunMoon className="w-3.5 h-3.5" />
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 hidden light:block" />
          <Moon className="w-3.5 h-3.5 hidden dark:block" />
        </>
      )}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}
