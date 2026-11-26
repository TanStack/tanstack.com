import * as DialogPrimitive from '@radix-ui/react-dialog'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import type { SpecimenProps } from './types'

/**
 * AUDIT SPECIMEN — verbatim shell of `src/components/SearchModal.tsx`
 * (the outer 40 lines of a 3,766-line file).
 *
 * The command-palette posture: full-bleed below `sm`, then top-anchored and
 * horizontally centred with a `max-w-4xl` cap — the only overlay that pins to
 * the top rather than the centre. Uses `forceMount` so its own CSS transitions
 * (`.search-modal-panel-transition`) can run instead of Radix data-state
 * animations, and overrides `onInteractOutside` to survive nested portals.
 *
 * This one should be the last thing migrated to any new primitive, not the
 * first — but the DS panel must be able to express this posture.
 */
export function SearchModalSpecimen({ open, onOpenChange }: SpecimenProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm xl:bg-black/30" />
        <DialogPrimitive.Content className="fixed z-[1000] inset-0 sm:inset-auto sm:top-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[96%] xl:w-full sm:max-w-4xl text-left outline-none">
          <DialogPrimitive.Title className="sr-only">
            Search TanStack
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search TanStack and open TanStack AI from the current query.
          </DialogPrimitive.Description>

          <div className="flex h-full flex-col overflow-hidden rounded-none border border-gray-200 bg-white shadow-2xl sm:h-auto sm:rounded-xl dark:border-white/10 dark:bg-gray-900">
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-white/10">
              <MagnifyingGlassIcon className="size-5 shrink-0 text-gray-400" />
              <input
                placeholder="Search docs, examples, blog…"
                className="w-full bg-transparent text-base outline-none placeholder:text-gray-400"
              />
              <kbd className="hidden shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-400 sm:block dark:border-white/10">
                ESC
              </kbd>
            </div>
            <div className="max-h-[60vh] flex-1 overflow-y-auto p-2">
              {['Quick Start', 'Installation', 'Data Loading', 'SSR'].map(
                (label) => (
                  <div
                    key={label}
                    className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    {label}
                  </div>
                ),
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
