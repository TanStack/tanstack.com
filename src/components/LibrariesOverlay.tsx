import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CaretDown, Check, X } from '@phosphor-icons/react'
import { type Framework, type Library } from '~/libraries'
import { frameworkOptions } from '~/libraries/frameworks'
import LibraryGridCard from '~/components/LibraryGridCard'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from '~/components/ds/ui'
import {
  getFrameworkLibraryCounts,
  getVisibleLibraries,
  orderLibrariesForBrowse,
} from '~/libraries/browse-utils'

export function LibrariesOverlay({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const allLibraries = getVisibleLibraries()
  const ordered = orderLibrariesForBrowse(allLibraries)
  const frameworkCounts = getFrameworkLibraryCounts(allLibraries)
  const frameworksWithLibraries = frameworkOptions.filter(
    (framework) => (frameworkCounts[framework.value] ?? 0) > 0,
  )

  const [activeFramework, setActiveFramework] =
    React.useState<Framework | null>(null)
  const activeFrameworkOption = activeFramework
    ? frameworkOptions.find((option) => option.value === activeFramework)
    : undefined
  const visibleLibraries = activeFramework
    ? ordered.filter((library) => library.frameworks.includes(activeFramework))
    : ordered

  // Reset the filter each time the overlay is opened.
  React.useEffect(() => {
    if (open) setActiveFramework(null)
  }, [open])

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        {/* Full-viewport glass; clicking it (outside the content column) closes.
            Reverse-vignette tint (dark centre → ~60% rim) + mega-menu blur, so the
            page shows through more toward the edges — see .libraries-overlay-glass. */}
        <DialogPrimitive.Overlay className="animate-library-overlay-in libraries-overlay-glass fixed inset-0 z-[110]" />
        <DialogPrimitive.Content
          aria-label="All Libraries"
          className="animate-library-overlay-in fixed inset-x-0 top-0 z-[111] mx-auto flex max-h-dvh w-full max-w-6xl flex-col overflow-y-auto px-4 pb-16 pt-28 outline-none"
          onInteractOutside={(event) => {
            // The framework dropdown portals outside this dialog's DOM, so
            // selecting an item would otherwise read as an outside interaction
            // and dismiss the overlay. Keep it open for menu interactions.
            const target = event.detail.originalEvent.target
            if (target instanceof Element && target.closest('[role="menu"]')) {
              event.preventDefault()
            }
          }}
        >
          <DialogPrimitive.Close
            aria-label="Close"
            className="fixed right-6 top-6 z-[112] flex size-14 items-center justify-center rounded-full corner-squircle text-text-secondary transition-colors hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10"
          >
            <X className="size-10" weight="light" />
          </DialogPrimitive.Close>
          <div className="flex items-center gap-6">
            {activeFrameworkOption ? (
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <img
                    src={activeFrameworkOption.logo}
                    alt=""
                    className="h-9 w-9 object-contain"
                  />
                  <DialogPrimitive.Title className="font-ds-display text-3xl font-medium text-text-primary">
                    TanStack {activeFrameworkOption.label} libraries
                  </DialogPrimitive.Title>
                </div>
                <DialogPrimitive.Description className="mt-2 max-w-2xl font-ds-mono text-xs leading-relaxed text-text-secondary">
                  Type-safe, headless TanStack primitives with{' '}
                  {activeFrameworkOption.label} support for routing, data, UI,
                  performance, and tooling.
                </DialogPrimitive.Description>
              </div>
            ) : (
              <>
                <DialogPrimitive.Title className="font-ds-display text-3xl font-medium text-text-primary">
                  All Libraries
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Browse the full set of public TanStack libraries.
                </DialogPrimitive.Description>
              </>
            )}

            <Dropdown>
              <DropdownTrigger>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg corner-squircle border border-black/[0.06] bg-background-surface px-3 py-2 font-ds-mono text-xs text-text-primary transition-colors hover:border-border-strong dark:border-white/[0.08] dark:bg-[#0a0a0a]"
                >
                  {activeFrameworkOption ? (
                    <img
                      src={activeFrameworkOption.logo}
                      alt=""
                      className="h-4 w-4 object-contain opacity-80 brightness-0 dark:invert"
                    />
                  ) : null}
                  <span>
                    {activeFrameworkOption
                      ? activeFrameworkOption.label
                      : 'All frameworks'}
                  </span>
                  <CaretDown className="size-3 text-text-secondary" />
                </button>
              </DropdownTrigger>
              <DropdownContent
                align="end"
                className="max-h-[60vh] overflow-y-auto font-ds-mono"
              >
                <DropdownItem onSelect={() => setActiveFramework(null)}>
                  <span className="flex-1">All frameworks</span>
                  <span className="text-text-muted">{ordered.length}</span>
                  {activeFramework === null ? (
                    <Check className="size-4 text-text-primary" />
                  ) : null}
                </DropdownItem>
                <DropdownSeparator />
                {frameworksWithLibraries.map((framework) => (
                  <DropdownItem
                    key={framework.value}
                    onSelect={() => setActiveFramework(framework.value)}
                  >
                    <img
                      src={framework.logo}
                      alt=""
                      loading="lazy"
                      className="h-4 w-4 object-contain opacity-80 brightness-0 dark:invert"
                    />
                    <span className="flex-1">{framework.label}</span>
                    <span className="text-text-muted">
                      {frameworkCounts[framework.value] ?? 0}
                    </span>
                    {activeFramework === framework.value ? (
                      <Check className="size-4 text-text-primary" />
                    ) : null}
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {visibleLibraries.map((library, i) => {
              // Cascade by row (3-col desktop layout): each row starts after the
              // previous, with a slight left-to-right offset. Begins once the
              // 150ms glass fade has settled.
              const columns = 3
              const row = Math.floor(i / columns)
              const col = i % columns
              const delay = 150 + row * 80 + col * 25

              return (
                <div
                  key={library.id}
                  className="h-full animate-library-card-reveal"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <LibraryGridCard library={library as Library} />
                </div>
              )
            })}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
