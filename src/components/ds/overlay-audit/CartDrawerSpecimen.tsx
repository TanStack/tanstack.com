import * as Dialog from '@radix-ui/react-dialog'
import { ShoppingCartIcon, XIcon } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import type { SpecimenProps } from './types'

/**
 * AUDIT SPECIMEN — verbatim shell of `src/components/shop/CartDrawer.tsx`.
 *
 * Two things to notice. First, it sits on a completely separate token
 * namespace (`bg-shop-bg-2`, `border-shop-line`, `text-shop-text`) defined in
 * `src/styles/shop.css`, which is only loaded on `/shop` routes — the DS audit
 * page has to link that stylesheet explicitly for this to render.
 *
 * Second, it is anchored rather than edge-flush: offset from the navbar via
 * `--navbar-height` and inset from the right by `1rem`, with its own `z-[100]`
 * tier that does not match either the `z-50` or `z-[999]/[1000]` families.
 */
export function CartDrawerSpecimen({ open, onOpenChange }: SpecimenProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="cart-overlay fixed inset-0 z-[100] bg-black/40" />
        <Dialog.Content
          className={twMerge(
            'shop-scope cart-panel',
            'fixed right-4 top-[calc(var(--navbar-height,56px)+0.5rem)] z-[100]',
            'w-[calc(100vw-2rem)] sm:w-[24rem]',
            'max-h-[calc(100dvh-var(--navbar-height,56px)-1rem)]',
            'flex flex-col rounded-xl',
            'bg-shop-bg-2 border border-shop-line text-shop-text',
            'shadow-2xl',
          )}
          aria-describedby={undefined}
        >
          <header className="flex items-center justify-between px-5 py-3 border-b border-shop-line">
            <Dialog.Title className="text-sm font-semibold uppercase tracking-wide">
              Cart (2)
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close cart"
              className="p-1 rounded-md text-shop-text-2 hover:text-shop-text"
            >
              <XIcon className="w-3.5 h-3.5" />
            </Dialog.Close>
          </header>

          <ul className="fade-y fade-size-y-sm min-h-0 flex-1 overflow-y-auto px-5">
            {['Classic Tee', 'Sticker Pack'].map((name) => (
              <li
                key={name}
                className="flex items-center gap-3 border-b border-shop-line py-4 last:border-b-0"
              >
                <div className="size-14 shrink-0 rounded-md bg-shop-surface" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="text-xs text-shop-text-2">Qty 1</p>
                </div>
                <span className="text-sm font-medium">$28.00</span>
              </li>
            ))}
          </ul>

          <footer className="px-5 py-4 flex flex-col gap-3 border-t border-shop-line">
            <div className="flex justify-between text-sm">
              <span className="text-shop-text-2">Subtotal</span>
              <span className="font-medium text-shop-text">$56.00</span>
            </div>
            <button
              type="button"
              className="w-full rounded-md bg-shop-accent px-4 py-2.5 font-semibold text-shop-accent-ink transition-[filter] hover:brightness-110"
            >
              Checkout
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** The drawer's own empty state — one of seven improvised empty states found. */
export function CartDrawerEmptySpecimen() {
  return (
    <div className="shop-scope flex flex-col items-center justify-center gap-4 rounded-xl border border-shop-line bg-shop-bg-2 p-8 text-center text-shop-text-2">
      <ShoppingCartIcon className="w-10 h-10 text-shop-muted" />
      <p>Your cart is empty.</p>
    </div>
  )
}
