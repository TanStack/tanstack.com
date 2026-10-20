import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CircleNotchIcon } from '@phosphor-icons/react/CircleNotch'
import { XIcon } from '@phosphor-icons/react/X'
import { twMerge } from 'tailwind-merge'

/**
 * Centered modal dialog.
 *
 * Always Radix-backed, which is the whole point: focus trapping, focus
 * restoration on close, Escape-to-dismiss and scroll lock come from the
 * primitive rather than from each call site remembering to implement them.
 * The overlay audit at /ds/overlays found that every accessibility failure on
 * the site came from a hand-rolled dialog, so this component does not offer an
 * opt-out.
 *
 * Composition mirrors Dropdown (Root + Trigger + Content + parts):
 *
 *   <Dialog open={open} onOpenChange={setOpen}>
 *     <DialogContent size="sm">
 *       <DialogHeader title="Sign in to continue" />
 *       <DialogBody>…</DialogBody>
 *       <DialogFooter>…</DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 */

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export type DialogSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizeStyles: Record<DialogSize, string> = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

type DialogContentProps = {
  children: React.ReactNode
  size?: DialogSize
  className?: string
  /** Escape hatch for content that manages its own dismissal (e.g. a wizard mid-submit). */
  onInteractOutside?: DialogPrimitive.DialogContentProps['onInteractOutside']
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(function DialogContent(
  { children, size = 'sm', className, onInteractOutside },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-ds-dialog-scrim=""
        className="fixed inset-0 z-[var(--z-scrim)] bg-scrim"
      />
      <DialogPrimitive.Content
        ref={ref}
        data-ds-dialog-panel=""
        onInteractOutside={onInteractOutside}
        className={twMerge(
          // Centring uses the independent `translate` property (that is what
          // Tailwind v4 compiles these to), which leaves `transform` free for
          // the enter/exit scale in app.css. The two compose.
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'z-[var(--z-overlay)] outline-none',
          // A gutter on small screens so the panel never touches the edge.
          'w-[calc(100vw-2rem)]',
          // Cap the height and let the body scroll rather than the viewport —
          // the audit's tallest centered dialog (the 5-step deploy wizard)
          // overflows without this.
          'max-h-[calc(100dvh-2rem)] flex flex-col',
          'rounded-xl corner-squircle border border-border-default bg-background-elevated text-text-primary shadow-2xl',
          // Enter/exit motion is attached in app.css via the data-ds-dialog-*
          // attributes, keyed off Radix's data-state.
          sizeStyles[size],
          className,
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

type DialogHeaderProps = {
  title: React.ReactNode
  /**
   * Rendered under the title. Radix warns when a dialog has no description, so
   * when this is omitted the description is still emitted, visually hidden.
   */
  description?: React.ReactNode
  /** Extra controls placed left of the close button. */
  actions?: React.ReactNode
  /**
   * An icon or mark shown in a tile to the left of the title. Use it when the
   * dialog is *about* a specific third party or object, not for decoration.
   */
  media?: React.ReactNode
  /**
   * A CSS colour that tints the media tile and washes the header behind it.
   *
   * A deliberate escape hatch from the token layer: these are third-party
   * brand colours (Cloudflare orange, Netlify teal) that cannot be DS tokens
   * because they are not ours. Everything else in the header stays on tokens.
   */
  tint?: string
  showClose?: boolean
  className?: string
}

export function DialogHeader({
  title,
  description,
  actions,
  media,
  tint,
  showClose = true,
  className,
}: DialogHeaderProps) {
  const tinted = media != null && tint != null

  return (
    <div
      className={twMerge(
        'flex shrink-0 items-start justify-between gap-4 px-6 pt-6',
        description ? 'pb-2' : 'pb-4',
        // A tinted header reads as a banded region, so it takes a full pad and
        // a rule rather than bleeding into the body.
        tinted && 'items-center border-b border-border-default py-4',
        className,
      )}
      style={
        tint
          ? {
              backgroundColor: `color-mix(in srgb, ${tint} 8%, transparent)`,
            }
          : undefined
      }
    >
      {media ? (
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg corner-squircle"
          style={tint ? { backgroundColor: tint } : undefined}
          aria-hidden="true"
        >
          {media}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <DialogPrimitive.Title className="text-lg font-semibold text-text-primary">
          {title}
        </DialogPrimitive.Title>
        <DialogPrimitive.Description
          className={description ? 'mt-1 text-sm text-text-muted' : 'sr-only'}
        >
          {description ?? 'Dialog'}
        </DialogPrimitive.Description>
      </div>

      <div className="flex shrink-0 items-center gap-1 self-start">
        {actions}
        {showClose ? (
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className="rounded-full corner-squircle p-1 text-icon-muted transition-colors hover:bg-surface-state-hover hover:text-icon-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        ) : null}
      </div>
    </div>
  )
}

export function DialogBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={twMerge('min-h-0 flex-1 overflow-y-auto px-6', className)}>
      {children}
    </div>
  )
}

export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'flex shrink-0 items-center justify-end gap-3 px-6 pb-6 pt-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------ DialogStatus -- */

export type DialogStatusTone = 'neutral' | 'success' | 'error' | 'loading'

/**
 * A centred status panel: mark, heading, description, actions.
 *
 * This is the shape every non-form step of the deploy dialogs already used —
 * "GitHub Authorization Required", "Repository Created!", "Deployment Failed",
 * and the two spinner states were five hand-built copies of one layout, each
 * picking its own raw red/green Tailwind pair. Tones map onto the existing
 * `status-*` tokens instead.
 *
 * Note this is not a stepper, and there is deliberately no Wizard component.
 * The deploy dialogs are state machines with no back/next and no progress
 * chrome, and they are only two call sites — below the threshold for
 * extracting their step dispatch. They render their branches inline, wrapped
 * in a keyed `data-ds-dialog-step` div so the panels cross-fade.
 */
const statusToneStyles: Record<
  Exclude<DialogStatusTone, 'loading'>,
  { ring: string; icon: string }
> = {
  neutral: { ring: 'bg-background-subtle', icon: 'text-icon-default' },
  success: { ring: 'bg-status-success-bg', icon: 'text-status-success' },
  error: { ring: 'bg-status-error-bg', icon: 'text-status-error' },
}

export function DialogStatus({
  tone = 'neutral',
  icon,
  title,
  description,
  actions,
  children,
  className,
}: {
  tone?: DialogStatusTone
  /** Ignored when tone is "loading" — the spinner is the mark. */
  icon?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** Extra content between the description and the actions. */
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'flex flex-col items-center py-4 text-center',
        className,
      )}
      // Announce late-arriving outcomes; a success or failure that only
      // changes pixels is invisible to a screen reader.
      role={tone === 'error' ? 'alert' : undefined}
      aria-live={tone === 'loading' ? 'polite' : undefined}
    >
      {tone === 'loading' ? (
        <CircleNotchIcon
          className="size-8 animate-spin text-icon-muted"
          aria-hidden="true"
        />
      ) : icon ? (
        <div
          className={twMerge(
            'mb-4 flex size-16 items-center justify-center rounded-full',
            statusToneStyles[tone].ring,
          )}
          aria-hidden="true"
        >
          <span
            className={twMerge('[&>svg]:size-8', statusToneStyles[tone].icon)}
          >
            {icon}
          </span>
        </div>
      ) : null}

      {title ? (
        <h3
          className={twMerge(
            'text-lg font-medium text-text-primary',
            tone === 'loading' ? 'mt-4' : 'mb-2',
          )}
        >
          {title}
        </h3>
      ) : null}

      {description ? (
        <p
          className={twMerge(
            'text-sm text-text-muted',
            tone === 'loading' && !title && 'mt-4',
          )}
        >
          {description}
        </p>
      ) : null}

      {children}

      {actions ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
