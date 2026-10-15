import * as React from 'react'
import { XIcon } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import type { SpecimenProps } from './types'

/**
 * AUDIT SPECIMEN — verbatim shell of `src/components/shop/ProductDrawer.tsx`.
 *
 * The only bottom-sheet posture on the site, and hand-rolled rather than
 * Radix: the Escape handler below is copied from the original because there is
 * no primitive supplying it. Uses three separate z-tiers (`60` scrim, `70`
 * sheet, `71` side arrows) and is the one overlay already wired to the motion
 * tokens (`--motion-duration-fast`, `--motion-ease-standard`).
 */
export function ProductDrawerSpecimen({ open, onOpenChange }: SpecimenProps) {
  // Copied verbatim from the original — hand-rolled because there is no
  // shared primitive providing dismiss-on-Escape.
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close product"
        onClick={() => onOpenChange(false)}
        className="shop-product-scrim fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity motion-reduce:transition-none"
      />
      <div
        className={twMerge(
          'shop-scope',
          'fixed left-1/2 bottom-0 z-[70] -translate-x-1/2',
          'flex w-[calc(100%-2rem)] max-w-[1400px] flex-col overflow-hidden',
          'rounded-t-2xl border border-b-0 border-shop-line',
          'shop-product-sheet shadow-2xl bg-shop-bg-2 text-shop-text',
          'h-[70dvh]',
        )}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 left-3 z-[3] p-1 text-shop-muted hover:text-shop-text transition-colors"
        >
          <XIcon className="w-4 h-4" />
        </button>

        <div className="shop-product-drawer-shell flex-1 overflow-y-auto [scrollbar-width:thin]">
          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <div className="aspect-square rounded-lg bg-shop-surface" />
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Classic Tee</h2>
              <p className="text-sm text-shop-text-2">
                A bottom-anchored sheet. Note there is no focus trap and no
                focus restoration on close — both would come free from Radix.
              </p>
              <button
                type="button"
                className="w-full max-w-[760px] rounded-full bg-shop-accent px-4 py-3 font-semibold text-shop-accent-ink"
              >
                Add to cart
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Side navigation arrows — a third z-tier above the sheet */}
      <button
        type="button"
        aria-label="Previous product"
        className="fixed left-6 top-1/2 z-[71] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-shop-line bg-shop-bg/90 text-shop-text shadow-xl backdrop-blur-sm transition-[transform,background-color,opacity] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] hover:bg-shop-surface-hover active:scale-95 motion-reduce:transition-none sm:flex"
      >
        ←
      </button>
      <button
        type="button"
        aria-label="Next product"
        className="fixed right-6 top-1/2 z-[71] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-shop-line bg-shop-bg/90 text-shop-text shadow-xl backdrop-blur-sm transition-[transform,background-color,opacity] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] hover:bg-shop-surface-hover active:scale-95 motion-reduce:transition-none sm:flex"
      >
        →
      </button>
    </>
  )
}
