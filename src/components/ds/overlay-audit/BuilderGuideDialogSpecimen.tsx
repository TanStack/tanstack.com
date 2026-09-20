import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowSquareOutIcon, XIcon } from '@phosphor-icons/react'
import { Button } from '~/components/ds/ui'
import type { SpecimenProps } from './types'

/**
 * AUDIT SPECIMEN — verbatim shell of
 * `src/components/charts/BuilderGuideDialog.tsx`.
 *
 * The strongest specimen in the set and the best starting point for the DS
 * primitive: semantic tokens throughout (`border-border-default`,
 * `bg-background-surface`, `text-text-primary`), real enter/exit animation via
 * Radix data-state, a fixed header over an independently scrolling body, and a
 * responsive posture that is full-bleed on mobile and a right-edge sheet from
 * `sm` up.
 */
export function BuilderGuideDialogSpecimen({
  open,
  onOpenChange,
}: SpecimenProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-3 z-[1000] flex flex-col overflow-hidden rounded-xl border border-border-default bg-background-surface text-text-primary shadow-2xl outline-none duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:top-3 sm:right-3 sm:bottom-3 sm:left-auto sm:w-full sm:max-w-2xl sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default px-4">
            <DialogPrimitive.Title className="text-sm font-semibold">
              Builder guide
            </DialogPrimitive.Title>
            <div className="flex items-center gap-1">
              <Button as="a" href="#" variant="ghost" size="xs">
                Plain text
                <ArrowSquareOutIcon className="size-3.5" aria-hidden="true" />
              </Button>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="icon"
                  size="icon-sm"
                  color="gray"
                  aria-label="Close builder guide"
                >
                  <XIcon className="size-4" aria-hidden="true" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </header>

          <DialogPrimitive.Description className="sr-only">
            Module rules, available imports, and authoring tips.
          </DialogPrimitive.Description>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <section key={i} className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Section {i + 1}
                </h3>
                <p className="text-sm text-text-secondary">
                  Long-form guide content. This body scrolls independently of
                  the fixed header above, which is the behaviour the DS panel
                  needs to preserve.
                </p>
              </section>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
