import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from '@phosphor-icons/react'
import { Button } from '~/ui'
import type { SpecimenProps } from './types'

/**
 * AUDIT SPECIMEN — verbatim shell of `src/components/AvatarCropModal.tsx`.
 * The react-easy-crop surface is replaced by a static stand-in; the shell,
 * footer action row and close affordance are unchanged.
 */
export function AvatarCropModalSpecimen({ open, onOpenChange }: SpecimenProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[1000] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Crop Profile Picture
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
              <XIcon className="w-5 h-5 text-gray-500" />
            </DialogPrimitive.Close>
          </div>

          <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
            <div className="size-40 rounded-full border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>

          <div className="mt-4">
            <label
              htmlFor="specimen-zoom"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Zoom
            </label>
            <input
              id="specimen-zoom"
              type="range"
              min={1}
              max={3}
              step={0.1}
              defaultValue={1}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button size="sm">Save</Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
