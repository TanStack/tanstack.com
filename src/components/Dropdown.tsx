import * as React from 'react'
import { Menu } from '@base-ui/react/menu'
import { twMerge } from 'tailwind-merge'

type DropdownProps = {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
}

type DropdownTriggerProps = {
  render: React.ReactElement
  className?: string
  // Set false when `render` is not a native <button> — e.g. the virtual anchor
  // BrandContextMenu positions at the cursor.
  nativeButton?: boolean
}

type DropdownContentProps = {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  portal?: boolean
  onFocus?: React.FocusEventHandler<HTMLDivElement>
  onPointerEnter?: React.PointerEventHandler<HTMLDivElement>
  onPointerLeave?: React.PointerEventHandler<HTMLDivElement>
}

type DropdownItemProps = {
  children?: React.ReactNode
  className?: string
  onSelect?: () => void
  render?: React.ReactElement
}

type DropdownSeparatorProps = {
  className?: string
}

export function Dropdown({
  children,
  open,
  onOpenChange,
  modal = false,
}: DropdownProps) {
  return (
    <Menu.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      {children}
    </Menu.Root>
  )
}

export function DropdownTrigger({
  render,
  className,
  nativeButton,
}: DropdownTriggerProps) {
  return (
    <Menu.Trigger
      className={className}
      render={render}
      nativeButton={nativeButton}
    />
  )
}

export function DropdownContent({
  children,
  className,
  align = 'end',
  sideOffset = 6,
  portal = true,
  onFocus,
  onPointerEnter,
  onPointerLeave,
}: DropdownContentProps) {
  const content = (
    <Menu.Positioner align={align} sideOffset={sideOffset} className="z-[1200]">
      <Menu.Popup
        onFocus={onFocus}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className={twMerge(
          'dropdown-content min-w-48 rounded-lg p-1.5',
          'border border-gray-200 dark:border-gray-700',
          'bg-white dark:bg-gray-800',
          'shadow-lg',
          className,
        )}
      >
        {children}
      </Menu.Popup>
    </Menu.Positioner>
  )

  if (!portal) {
    return content
  }

  return <Menu.Portal>{content}</Menu.Portal>
}

export function DropdownItem({
  children,
  className,
  onSelect,
  render,
}: DropdownItemProps) {
  const itemClassName = twMerge(
    'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 outline-none',
    'text-sm text-gray-700 dark:text-gray-300',
    'hover:bg-gray-100 dark:hover:bg-gray-700/50',
    'data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-700/50',
    'transition-colors duration-150',
    className,
  )

  if (render) {
    return (
      <Menu.Item onClick={onSelect} className={itemClassName} render={render} />
    )
  }

  return (
    <Menu.Item onClick={onSelect} className={itemClassName}>
      {children}
    </Menu.Item>
  )
}

export function DropdownSeparator({ className }: DropdownSeparatorProps) {
  return (
    <Menu.Separator
      className={twMerge('my-1 h-px bg-gray-200 dark:bg-gray-700', className)}
    />
  )
}
