import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowLeft as ArrowLeftIcon } from '@phosphor-icons/react/ArrowLeft'
import { X as XIcon } from '@phosphor-icons/react/X'
import { LibrariesBrowser } from '~/components/LibrariesBrowser'

export function LibrariesOverlay({
  open,
  onBack,
  onClose,
}: {
  open: boolean
  onBack?: () => void
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
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="fixed left-4 top-4 z-[112] inline-flex h-11 items-center gap-2 rounded-xl bg-background-subtle px-3 font-ds-display text-ds-body-md font-medium text-text-primary transition-colors hover:bg-surface-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus min-[900px]:hidden"
            >
              <ArrowLeftIcon className="size-5" />
              Back to menu
            </button>
          ) : null}
          <DialogPrimitive.Close
            aria-label="Close"
            className="fixed right-4 top-4 z-[112] flex size-11 items-center justify-center rounded-full corner-squircle text-text-secondary transition-colors hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10 min-[900px]:right-6 min-[900px]:top-6 min-[900px]:size-14"
          >
            <XIcon className="size-7 min-[900px]:size-10" weight="light" />
          </DialogPrimitive.Close>
          <LibrariesBrowser variant="dialog" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
