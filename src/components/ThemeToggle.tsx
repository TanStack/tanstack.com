import * as React from 'react'
import { useTheme } from './ThemeProvider'
import { Moon as MoonIcon } from '@phosphor-icons/react/Moon'
import { Sun as SunIcon } from '@phosphor-icons/react/Sun'
import { SunHorizon as SunHorizonIcon } from '@phosphor-icons/react/SunHorizon'
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
        <SunHorizonIcon className={getIconClassName('auto')} weight="bold" />
        <SunIcon className={getIconClassName('light')} weight="bold" />
        <MoonIcon className={getIconClassName('dark')} weight="bold" />
      </span>
    </Button>
  )
}
