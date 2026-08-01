import * as React from 'react'
import { useTheme } from './ThemeProvider'
import { Moon, Sun, SunHorizon } from '@phosphor-icons/react'
import { Button } from '~/ui'

export function ThemeToggle() {
  const { themeMode, resolvedTheme, toggleMode } = useTheme()

  const handleToggleMode = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    toggleMode()
  }

  const label =
    themeMode === 'auto' ? 'Auto' : themeMode === 'light' ? 'Light' : 'Dark'

  const nextLabel =
    themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto'

  const activeIcon = themeMode === 'auto' ? 'auto' : resolvedTheme

  const getIconClassName = (icon: typeof activeIcon) =>
    [
      'col-start-1 row-start-1 size-[18px] shrink-0 transition-opacity motion-reduce:transition-none',
      activeIcon === icon ? 'opacity-100' : 'opacity-0',
    ].join(' ')

  return (
    <Button
      type="button"
      variant="icon"
      color="gray"
      size="icon-sm"
      onClick={handleToggleMode}
      aria-label={`Theme: ${label}. Switch to ${nextLabel} mode.`}
      title={`Theme: ${label}. Switch to ${nextLabel} mode.`}
      className="h-8 w-8 shrink-0 rounded-md border-0 p-0 leading-none text-icon-default shadow-none hover:bg-surface-state-hover hover:text-text-primary"
    >
      <span
        aria-hidden="true"
        className="grid size-[18px] shrink-0 place-items-center"
      >
        <SunHorizon className={getIconClassName('auto')} weight="bold" />
        <Sun className={getIconClassName('light')} weight="bold" />
        <Moon className={getIconClassName('dark')} weight="bold" />
      </span>
    </Button>
  )
}
