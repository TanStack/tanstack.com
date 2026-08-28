import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from '@phosphor-icons/react/X'
import { twMerge } from 'tailwind-merge'

/**
 * Edge-anchored panel — the drawer / side sheet.
 *
 * Same Radix foundation as Dialog (focus trap, focus restoration, Escape,
 * scroll lock) and the same three-region layout, but anchored to an edge
 * instead of centred. `side` covers right, left and bottom: they are one
 * mechanism — a surface arriving from off-screen — differing only in axis.
 *
 *   <Drawer open={open} onOpenChange={setOpen}>
 *     <DrawerContent side="right" size="lg">
 *       <DrawerHeader title="Builder guide" />
 *       <DrawerBody>…</DrawerBody>
 *       <DrawerFooter>…</DrawerFooter>
 *     </DrawerContent>
 *   </Drawer>
 */

export const Drawer = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close

/**
 * The accessible name and description, for panels that do not use
 * DrawerHeader. A drawer whose design has no visible title bar still needs a
 * name, so it renders one of these with `className="sr-only"`. Use these OR
 * DrawerHeader — never both, or the dialog ends up with two titles.
 */
export const DrawerTitle = DialogPrimitive.Title
export const DrawerDescription = DialogPrimitive.Description

export type DrawerSide = 'right' | 'left' | 'bottom'
/**
 * What the panel is pinned to. `viewport` sits in the window's top gutter;
 * `navbar` clears the site header, so the panel reads as belonging to the
 * chrome that opened it rather than floating over it. This is the audit's
 * "anchored panel" posture — it was a separate implementation in CartDrawer
 * only because a top offset had nowhere to live.
 */
export type DrawerAnchor = 'viewport' | 'navbar'
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/** Width for right/left; the panel spans the full height minus a gutter. */
const horizontalSize: Record<DrawerSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
}

/** Height for bottom; width is capped separately. */
const bottomSize: Record<DrawerSize, string> = {
  sm: 'h-[40dvh]',
  md: 'h-[55dvh]',
  lg: 'h-[70dvh]',
  xl: 'h-[85dvh]',
  '2xl': 'h-[92dvh]',
}

const sideStyles: Record<DrawerSide, string> = {
  // Full-bleed (minus a gutter) below `sm`, then a right-edge sheet. This is
  // the posture change BuilderGuideDialog established and it is the right
  // default: a 24rem side panel on a 375px screen is not a side panel.
  right:
    'left-3 right-3 rounded-xl corner-squircle sm:left-auto sm:right-3 sm:w-full',
  left: 'left-3 right-3 rounded-xl corner-squircle sm:right-auto sm:left-3 sm:w-full',
  // Centred with auto margins, not a translate — see the note in app.css.
  bottom:
    'left-4 right-4 bottom-0 mx-auto max-w-[1400px] rounded-t-2xl border-b-0',
}

/**
 * Vertical extent for right/left. `fit` sizes the panel to its content and
 * caps it at the viewport, which is what the shipping CartDrawer does: a
 * two-line cart pinned to a full-height panel strands its checkout button at
 * the bottom of a column of empty space.
 */
const horizontalHeight = {
  full: 'bottom-3',
  fit: 'bottom-auto max-h-[calc(100dvh-1.5rem)]',
} as const

/**
 * Top edge and, when `fit`, the height cap that follows from it. The navbar
 * height is read from `--navbar-height` with the same 56px fallback the
 * navbar itself uses, so the panel stays correct if the header resizes.
 */
const horizontalAnchor: Record<DrawerAnchor, { top: string; fitCap: string }> =
  {
    viewport: {
      top: 'top-3',
      fitCap: 'max-h-[calc(100dvh-1.5rem)]',
    },
    navbar: {
      top: 'top-[calc(var(--navbar-height,56px)+0.5rem)]',
      fitCap: 'max-h-[calc(100dvh-var(--navbar-height,56px)-1rem)]',
    },
  }

type DrawerContentProps = {
  children: React.ReactNode
  side?: DrawerSide
  size?: DrawerSize
  /**
   * Where a right/left panel's top edge sits. Ignored for `side="bottom"`,
   * which is anchored to the opposite edge.
   */
  anchor?: DrawerAnchor
  /**
   * Size the panel to its content instead of filling the edge, capped at the
   * viewport. Use it when the drawer's content is short and self-contained (a
   * cart, a filter list); leave it off for long-form content that should own
   * the full edge.
   */
  fit?: boolean
  className?: string
  onInteractOutside?: DialogPrimitive.DialogContentProps['onInteractOutside']
}

export const DrawerContent = React.forwardRef<
  HTMLDivElement,
  DrawerContentProps
>(function DrawerContent(
  {
    children,
    side = 'right',
    size = 'md',
    anchor = 'viewport',
    fit = false,
    className,
    onInteractOutside,
  },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-ds-drawer-scrim=""
        className="fixed inset-0 z-[var(--z-scrim)] bg-scrim"
      />
      <DialogPrimitive.Content
        ref={ref}
        data-ds-drawer-panel=""
        data-side={side}
        onInteractOutside={onInteractOutside}
        className={twMerge(
          'fixed z-[var(--z-overlay)] flex flex-col overflow-hidden outline-none',
          'border border-border-default bg-background-elevated text-text-primary shadow-2xl',
          sideStyles[side],
          side === 'bottom'
            ? fit
              ? 'h-auto max-h-[85dvh]'
              : bottomSize[size]
            : [
                horizontalSize[size],
                horizontalAnchor[anchor].top,
                fit
                  ? ['bottom-auto', horizontalAnchor[anchor].fitCap]
                  : horizontalHeight.full,
              ],
          className,
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

type DrawerHeaderProps = {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  showClose?: boolean
  className?: string
}

/**
 * Fixed header. Unlike DialogHeader this sits on a border, because a drawer's
 * body scrolls under it far more often than a dialog's does and an unbounded
 * header lets content appear to float out of nowhere.
 */
export function DrawerHeader({
  title,
  description,
  actions,
  showClose = true,
  className,
}: DrawerHeaderProps) {
  return (
    <div
      className={twMerge(
        'flex shrink-0 items-start justify-between gap-4 border-b border-border-default px-4 py-3 sm:px-6',
        className,
      )}
    >
      <div className="min-w-0">
        <DialogPrimitive.Title className="text-sm font-semibold text-text-primary">
          {title}
        </DialogPrimitive.Title>
        <DialogPrimitive.Description
          className={description ? 'mt-1 text-sm text-text-muted' : 'sr-only'}
        >
          {description ?? 'Drawer'}
        </DialogPrimitive.Description>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {actions}
        {showClose ? (
          <DialogPrimitive.Close
            aria-label="Close drawer"
            className="rounded-full corner-squircle p-1 text-icon-muted transition-colors hover:bg-surface-state-hover hover:text-icon-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        ) : null}
      </div>
    </div>
  )
}

export function DrawerBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={twMerge(
        // `flex-auto` (flex: 1 1 auto), not `flex-1` (flex: 1 1 0%): it grows
        // to fill a full-height panel so the footer pins to the bottom, and
        // sizes to its content in a `fit` panel so the footer hugs the items.
        'min-h-0 flex-auto overflow-y-auto px-4 py-5 sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function DrawerFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'flex shrink-0 items-center justify-end gap-3 border-t border-border-default px-4 py-3 sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
