import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react'
import { LibrariesBrowser } from '~/components/LibrariesBrowser'

export function LibrariesOverlay({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-library-overlay-in libraries-overlay-glass fixed inset-0 z-[110]" />
        <DialogPrimitive.Content
          className="animate-library-overlay-in libraries-overlay-scroll fixed inset-0 z-[111] flex flex-col overflow-y-auto outline-none"
          onInteractOutside={(event) => {
            const target = event.detail.originalEvent.target
            if (target instanceof Element && target.closest('[role="menu"]')) {
              event.preventDefault()
            }
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <DialogPrimitive.Close
            aria-label="Close"
            className="fixed right-6 top-6 z-[112] flex size-14 items-center justify-center rounded-full corner-squircle text-text-secondary transition-colors hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10"
          >
            <X className="size-10" weight="light" />
          </DialogPrimitive.Close>
          <LibrariesBrowser variant="dialog" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
