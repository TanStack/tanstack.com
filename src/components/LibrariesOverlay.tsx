import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { type Framework, type Library } from '~/libraries'
import { frameworkOptions } from '~/libraries/frameworks'
import LibraryGridCard from '~/components/LibraryGridCard'
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
            Mirrors the mega-menu glass (see .ts-mega-dropdown-panel in app.css). */}
        <DialogPrimitive.Overlay
          className={
            'fixed inset-0 z-[110] bg-[rgb(255_255_255/0.94)] ' +
            'dark:bg-[rgb(0_0_0/0.88)] [backdrop-filter:blur(100px)_saturate(1.9)] ' +
            '[-webkit-backdrop-filter:blur(100px)_saturate(1.9)]'
          }
        />
        <DialogPrimitive.Content
          aria-label="All Libraries"
          className="fixed inset-x-0 top-0 z-[111] mx-auto flex max-h-dvh w-full max-w-6xl flex-col overflow-y-auto px-4 py-10 outline-none md:py-16"
        >
          <div className="flex items-start justify-between gap-4">
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
            <DialogPrimitive.Close
              aria-label="Close"
              className="flex size-10 shrink-0 items-center justify-center rounded-full corner-squircle text-text-secondary transition-colors hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10"
            >
              <X className="size-5" weight="bold" />
            </DialogPrimitive.Close>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <FrameworkPill
              active={activeFramework === null}
              onClick={() => setActiveFramework(null)}
            >
              <span className="text-text-primary">All</span>
              <span>{ordered.length}</span>
            </FrameworkPill>
            {frameworksWithLibraries.map((framework) => {
              const count = frameworkCounts[framework.value] ?? 0

              return (
                <FrameworkPill
                  key={framework.value}
                  active={activeFramework === framework.value}
                  onClick={() =>
                    setActiveFramework((prev) =>
                      prev === framework.value ? null : framework.value,
                    )
                  }
                >
                  <img
                    src={framework.logo}
                    alt=""
                    loading="lazy"
                    className="h-5 w-5 object-contain"
                  />
                  <span className="text-text-primary">{framework.label}</span>
                  <span>{count}</span>
                </FrameworkPill>
              )
            })}
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {visibleLibraries.map((library, i) => (
              <div
                key={library.id}
                className="h-full animate-library-card-reveal"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <LibraryGridCard library={library as Library} />
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function FrameworkPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        'inline-flex items-center gap-2 rounded-lg corner-squircle border px-3 py-2 font-ds-mono text-xs transition-colors',
        active
          ? 'border-text-primary bg-background-subtle text-text-secondary dark:border-ds-neutral-100 dark:bg-[#151515]'
          : 'border-border-subtle bg-background-surface text-text-secondary hover:border-border-strong dark:border-ds-neutral-400 dark:bg-[#0a0a0a]',
      )}
    >
      {children}
    </button>
  )
}
