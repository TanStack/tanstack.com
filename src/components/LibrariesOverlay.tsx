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
      onOpenChange={(next, details) => {
        // The browser portals its own menus. A press inside one is outside the
        // takeover as far as the dialog is concerned, so it would dismiss the
        // whole overlay; keep it open and let the menu handle its own press.
        if (
          details.reason === 'outside-press' &&
          details.event.target instanceof Element &&
          details.event.target.closest('[role="menu"]')
        ) {
          details.cancel()
          return
        }
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
      >
        <LibrariesBrowser variant="dialog" />
      </TakeoverContent>
    </Takeover>
  )
}
