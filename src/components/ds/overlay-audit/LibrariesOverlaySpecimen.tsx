import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from '@phosphor-icons/react'
import type { SpecimenProps } from './types'

/**
 * AUDIT SPECIMEN — verbatim shell of `src/components/LibrariesOverlay.tsx`.
 *
 * The immersive full-bleed posture: no panel, no visible chrome, content
 * scrolls edge to edge and the close affordance floats over it on its own
 * `z-[112]` tier. Uses the semantic token layer and a bespoke glass treatment
 * (`.libraries-overlay-glass`, `.animate-library-overlay-in` in app.css)
 * instead of a shared elevation or motion token.
 */
export function LibrariesOverlaySpecimen({
  open,
  onOpenChange,
}: SpecimenProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-library-overlay-in libraries-overlay-glass fixed inset-0 z-[110]" />
        <DialogPrimitive.Content className="animate-library-overlay-in libraries-overlay-scroll fixed inset-0 z-[111] flex flex-col overflow-y-auto outline-none">
          <DialogPrimitive.Title className="sr-only">
            Libraries
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Browse every TanStack library.
          </DialogPrimitive.Description>

          <DialogPrimitive.Close
            aria-label="Close"
            className="fixed right-4 top-4 z-[112] flex size-11 items-center justify-center rounded-full corner-squircle text-text-secondary transition-colors hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10 min-[900px]:right-6 min-[900px]:top-6 min-[900px]:size-14"
          >
            <XIcon className="size-6" />
          </DialogPrimitive.Close>

          <div className="mx-auto grid w-full max-w-5xl gap-4 p-16 sm:grid-cols-2 lg:grid-cols-3">
            {[
              'Router',
              'Query',
              'Table',
              'Form',
              'Store',
              'Virtual',
              'Ranger',
              'Pacer',
              'DB',
            ].map((name) => (
              <div
                key={name}
                className="rounded-xl border border-border-default bg-background-surface p-5"
              >
                <p className="font-medium text-text-primary">TanStack {name}</p>
                <p className="mt-1 text-sm text-text-muted">
                  Full-bleed overlay content, scrolling edge to edge.
                </p>
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
