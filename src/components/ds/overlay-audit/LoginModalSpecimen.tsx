import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from '@phosphor-icons/react/X'
import type { SpecimenProps } from './types'

/**
 * AUDIT SPECIMEN — verbatim shell of `src/components/LoginModal.tsx`.
 *
 * Copied for side-by-side review only. Auth calls are stubbed; every class
 * name on the overlay, panel, header and close button is unchanged from the
 * original so the comparison is honest. Do not import this outside /ds.
 */
export function LoginModalSpecimen({ open, onOpenChange }: SpecimenProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[1000] w-full max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
          <div className="flex items-center justify-between mb-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Sign in to continue
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close sign-in dialog"
              className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <XIcon className="w-5 h-5 text-gray-500" />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className="sr-only">
            Choose a sign-in method.
          </DialogPrimitive.Description>

          <div className="space-y-3">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              Continue with GitHub
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 bg-[#DB4437] hover:bg-[#c53929] text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              Continue with Google
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
