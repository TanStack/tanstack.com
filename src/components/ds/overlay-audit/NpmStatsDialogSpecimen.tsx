import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from '@phosphor-icons/react'
import type { SpecimenProps } from './types'

/**
 * AUDIT SPECIMEN — verbatim shell of the inline dialog in
 * `src/routes/stats/npm/index.tsx` (~line 1084). A fourth independent
 * re-declaration of the centered Radix panel, defined inside a route file
 * rather than a component.
 */
export function NpmStatsDialogSpecimen({ open, onOpenChange }: SpecimenProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[1000] w-[calc(100%-1rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white dark:bg-gray-900 p-4 shadow-xl outline-none">
          <div className="flex justify-between items-center mb-4">
            <DialogPrimitive.Title className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100">
              Compare packages
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <XIcon className="w-5 h-5 text-gray-500" />
            </DialogPrimitive.Close>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add up to five npm packages to chart their download trends together.
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
