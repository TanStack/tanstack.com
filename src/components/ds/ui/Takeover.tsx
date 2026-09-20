import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from '@phosphor-icons/react/X'
import { twMerge } from 'tailwind-merge'

/**
 * Full-bleed takeover — the immersive posture.
 *
 * Unlike Dialog and Drawer there is no panel: the content fills the viewport
 * and scrolls edge to edge, with the close affordance floating over it. Use it
 * when the overlay *is* the destination rather than something shown alongside
 * the page.
 *
 *   <Takeover open={open} onOpenChange={setOpen}>
 *     <TakeoverContent scrim="glass" leading={<BackButton />}>
 *       <TakeoverTitle>All Libraries</TakeoverTitle>
 *       …
 *     </TakeoverContent>
 *   </Takeover>
 */

export const Takeover = DialogPrimitive.Root
export const TakeoverTrigger = DialogPrimitive.Trigger
export const TakeoverClose = DialogPrimitive.Close

/**
 * The accessible name and description. A takeover has no header bar, so these
 * are placed wherever the content wants them — visible or `sr-only`.
 */
export const TakeoverTitle = DialogPrimitive.Title
export const TakeoverDescription = DialogPrimitive.Description

export type TakeoverScrim = 'standard' | 'glass'

type TakeoverContentProps = {
  children: React.ReactNode
  /**
   * `standard` dims the page with the shared scrim. `glass` dissolves it
   * behind a heavy blur — for takeovers that should feel like a new surface
   * rather than a layer over the old one.
   */
  scrim?: TakeoverScrim
  /** An action floated top-left, opposite the close button (e.g. "Back"). */
  leading?: React.ReactNode
  closeLabel?: string
  /**
   * Close when the backdrop area of the content is clicked. On by default:
   * the content fills the viewport, so its empty space reads as the backdrop
   * even though it is technically inside the dialog.
   */
  dismissOnBackdropClick?: boolean
  className?: string
  onInteractOutside?: DialogPrimitive.DialogContentProps['onInteractOutside']
}

export const TakeoverContent = React.forwardRef<
  HTMLDivElement,
  TakeoverContentProps
>(function TakeoverContent(
  {
    children,
    scrim = 'standard',
    leading,
    closeLabel = 'Close',
    dismissOnBackdropClick = true,
    className,
    onInteractOutside,
  },
  ref,
) {
  // The content fills the viewport, so Radix never sees a click as "outside".
  // Backdrop dismissal therefore routes through the close button we already
  // render, rather than a second dismissal path that could drift from it.
  const closeRef = React.useRef<HTMLButtonElement>(null)

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-ds-takeover-scrim={scrim}
        className="fixed inset-0 z-[var(--z-scrim)]"
      />
      <DialogPrimitive.Content
        ref={ref}
        data-ds-takeover-panel=""
        onInteractOutside={onInteractOutside}
        onClick={
          dismissOnBackdropClick
            ? (event) => {
                // Only the content's own empty space, never a click that
                // bubbled up from something inside it.
                if (event.target === event.currentTarget) {
                  closeRef.current?.click()
                }
              }
            : undefined
        }
        className={twMerge(
          'fixed inset-0 z-[var(--z-overlay)] flex flex-col overflow-y-auto outline-none',
          className,
        )}
      >
        {leading ? (
          <div className="fixed left-4 top-4 z-[1]">{leading}</div>
        ) : null}

        <DialogPrimitive.Close
          ref={closeRef}
          aria-label={closeLabel}
          className="fixed right-4 top-4 z-[1] flex size-11 items-center justify-center rounded-full corner-squircle text-text-secondary transition-colors hover:bg-surface-state-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus min-[900px]:right-6 min-[900px]:top-6 min-[900px]:size-14"
        >
          <XIcon className="size-7 min-[900px]:size-10" weight="light" />
        </DialogPrimitive.Close>

        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
