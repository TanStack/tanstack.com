import { ArrowLeftIcon } from '@phosphor-icons/react/ArrowLeft'
import { LibrariesBrowser } from '~/components/LibrariesBrowser'
import { Takeover, TakeoverContent } from '~/components/ds/ui'

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
    <Takeover
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <TakeoverContent
        scrim="glass"
        className="libraries-overlay-scroll"
        leading={
          onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-background-subtle px-3 font-ds-display text-ds-body-md font-medium text-text-primary transition-colors hover:bg-surface-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus min-[900px]:hidden"
            >
              <ArrowLeftIcon className="size-5" />
              Back to menu
            </button>
          ) : null
        }
        onInteractOutside={(event) => {
          const target = event.detail.originalEvent.target
          if (target instanceof Element && target.closest('[role="menu"]')) {
            event.preventDefault()
          }
        }}
      >
        <LibrariesBrowser variant="dialog" />
      </TakeoverContent>
    </Takeover>
  )
}
