import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from './Dropdown'
import {
  LightbulbIcon,
  ChatCenteredIcon,
  PlusIcon,
} from '@phosphor-icons/react'

interface DocFeedbackFloatingButtonProps {
  onAddNote: () => void
  onAddFeedback: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  hasNote?: boolean
  hasImprovement?: boolean
  onShowNote?: () => void
  isMenuOpen?: boolean
  onMenuOpenChange?: (isOpen: boolean) => void
}

export function DocFeedbackFloatingButton({
  onAddNote,
  onAddFeedback,
  onMouseEnter,
  onMouseLeave,
  hasNote = false,
  hasImprovement = false,
  onShowNote,
  isMenuOpen: controlledIsMenuOpen,
  onMenuOpenChange,
}: DocFeedbackFloatingButtonProps) {
  const [internalIsMenuOpen, setInternalIsMenuOpen] = React.useState(false)
  const isControlled = controlledIsMenuOpen !== undefined
  const isMenuOpen = isControlled ? controlledIsMenuOpen : internalIsMenuOpen
  const setIsMenuOpen = (value: boolean) => {
    if (isControlled) {
      onMenuOpenChange?.(value)
    } else {
      setInternalIsMenuOpen(value)
    }
  }
  return (
    <Dropdown
      open={isMenuOpen}
      onOpenChange={(open) => {
        if (open && hasNote) onShowNote?.()
        setIsMenuOpen(open)
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
      <div
        className="doc-feedback-floating-btn absolute top-0 right-0 -translate-y-full z-30"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Button - neutral with shadow */}
        <DropdownTrigger>
          <button
            type="button"
            className={twMerge(
              'flex items-center justify-center',
              'w-6 h-6 rounded',
              'bg-white dark:bg-gray-800',
              'text-gray-600 dark:text-gray-400',
              'border border-gray-200 dark:border-gray-700',
              'shadow-md hover:shadow-lg',
              'hover:bg-gray-50 dark:hover:bg-gray-700',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
              isMenuOpen && 'shadow-lg bg-gray-50 dark:bg-gray-700',
            )}
            title="Add feedback"
          >
            <PlusIcon
              className={twMerge(
                'text-[10px] transition-transform duration-200',
                isMenuOpen && 'rotate-45',
              )}
            />
          </button>
        </DropdownTrigger>

        {/* Context Menu */}
        <DropdownContent sideOffset={8} className="w-48 p-0 overflow-hidden">
          {!hasNote && (
            <>
              <DropdownItem
                onSelect={onAddNote}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <ChatCenteredIcon className="text-blue-500" />
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    Add Note
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Personal annotation
                  </div>
                </div>
              </DropdownItem>
              {!hasImprovement && (
                <div className="h-px bg-gray-200 dark:bg-gray-700" />
              )}
            </>
          )}
          {!hasImprovement && (
            <DropdownItem
              onSelect={onAddFeedback}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <LightbulbIcon className="text-yellow-500" />
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-white">
                  Suggest Improvement
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Help improve docs
                </div>
              </div>
            </DropdownItem>
          )}
        </DropdownContent>
      </div>
    </Dropdown>
  )
}
