import * as React from 'react'
import { CommandIcon } from '@phosphor-icons/react/Command'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/MagnifyingGlass'
import { SparkleIcon } from '@phosphor-icons/react/Sparkle'
import { twMerge } from 'tailwind-merge'
import { Button, Tooltip } from '~/ui'
import { useSearchContext } from '~/contexts/SearchContext'

interface SearchButtonProps {
  className?: string
  iconOnly?: boolean
}

export function SearchButton({
  className,
  iconOnly = false,
}: SearchButtonProps) {
  const { openSearch } = useSearchContext()

  return (
    <Button
      type="button"
      data-search-trigger="true"
      onClick={openSearch}
      aria-label="Search TanStack"
      aria-haspopup="dialog"
      variant={iconOnly ? 'icon' : 'ghost'}
      color="gray"
      size={iconOnly ? 'icon-sm' : 'xs'}
      title="Search"
      className={twMerge(
        iconOnly
          ? 'h-8 w-8 rounded-md border-0 p-0 text-icon-default shadow-none hover:bg-surface-state-hover hover:text-text-primary'
          : 'gap-2 bg-gray-500/5 dark:bg-gray-500/30',
        className,
      )}
    >
      <MagnifyingGlassIcon
        className={iconOnly ? 'size-[18px]' : 'size-3.5'}
        weight={iconOnly ? 'bold' : undefined}
      />
      {iconOnly ? (
        <span className="sr-only">Search</span>
      ) : (
        <>
          <span>Search...</span>
          <div className="flex items-center bg-gray-500/10 dark:bg-gray-500/30 rounded px-1 py-0.5 gap-0.5 text-[10px] whitespace-nowrap">
            <CommandIcon className="w-2.5 h-2.5" /> K
          </div>
        </>
      )}
    </Button>
  )
}

export function AiDockButton({ className }: { className?: string }) {
  const {
    cancelAiDockHoverClose,
    closeAiDock,
    isAiDockDirty,
    isAiDockOpen,
    openAiDock,
    scheduleAiDockHoverClose,
  } = useSearchContext()
  const openedByHoverRef = React.useRef(false)

  const handlePointerEnter = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch') {
      return
    }

    cancelAiDockHoverClose()

    if (isAiDockDirty && !isAiDockOpen) {
      openedByHoverRef.current = true
      openAiDock()
    }
  }

  const handlePointerLeave = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch') {
      return
    }

    openedByHoverRef.current = false

    if (isAiDockDirty) {
      scheduleAiDockHoverClose()
    }
  }

  const handleClick = () => {
    if (openedByHoverRef.current) {
      openedByHoverRef.current = false
      return
    }

    if (isAiDockOpen) {
      closeAiDock()
      return
    }

    openAiDock()
  }

  return (
    <Tooltip content="Ask AI" side="bottom" delayDuration={0}>
      <Button
        type="button"
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        aria-label={isAiDockOpen ? 'Close AI panel' : 'Open AI panel'}
        aria-haspopup="dialog"
        aria-pressed={isAiDockOpen}
        variant="icon"
        color="gray"
        size="icon-sm"
        className={twMerge(
          'h-8 w-8 rounded-md border-0 p-0 text-icon-default shadow-none hover:bg-surface-state-hover hover:text-text-primary',
          isAiDockOpen &&
            'bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300',
          className,
        )}
      >
        <SparkleIcon aria-hidden="true" className="size-[18px]" weight="bold" />
        <span className="sr-only">Ask AI</span>
      </Button>
    </Tooltip>
  )
}
