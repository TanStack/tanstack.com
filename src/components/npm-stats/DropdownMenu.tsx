import * as React from 'react'
import { Menu } from '@base-ui/react/menu'
import { twMerge } from 'tailwind-merge'

/**
 * Base UI menu shaped like the flat `DropdownMenu*` API the stats and chart
 * controls already use, so those call sites stay unchanged. Base UI splits the
 * menu surface into `Positioner` + `Popup`; `DropdownMenuContent` keeps that
 * split internal and applies the caller's className to the popup.
 */

export function DropdownMenu({
  children,
  open,
  onOpenChange,
  modal = false,
}: {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
}) {
  return (
    <Menu.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      {children}
    </Menu.Root>
  )
}

export function DropdownMenuTrigger({
  render,
  className,
}: {
  render: React.ReactElement
  className?: string
}) {
  return <Menu.Trigger className={className} render={render} />
}

export function DropdownMenuContent({
  children,
  className,
  align = 'start',
  sideOffset = 4,
  collisionPadding,
}: {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  collisionPadding?: number
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="z-50"
      >
        <Menu.Popup className={className}>{children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export function DropdownMenuItem({
  children,
  className,
  onSelect,
  disabled,
  closeOnClick,
}: {
  children: React.ReactNode
  className?: string
  onSelect?: (event: React.MouseEvent) => void
  disabled?: boolean
  closeOnClick?: boolean
}) {
  return (
    <Menu.Item
      onClick={onSelect}
      disabled={disabled}
      closeOnClick={closeOnClick}
      className={twMerge('outline-none', className)}
    >
      {children}
    </Menu.Item>
  )
}
