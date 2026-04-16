import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Link } from '@tanstack/react-router'
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useCart, useRemoveCartLine, useUpdateCartLine } from '~/hooks/useCart'
import { formatMoney, shopifyImageUrl } from '~/utils/shopify-format'
import type { CartLineDetail } from '~/utils/shopify-queries'

type CartDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Slide-in cart drawer. Shares state with /shop/cart through the same
 * useCart React Query key, so adds in the drawer mirror the full page
 * and vice-versa. Pinned to the right on desktop; full-width slide-up on
 * mobile would be nice later, but a right-anchored sheet is the standard
 * Shopify-theme pattern and works on phones too.
 */
export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const { cart, totalQuantity } = useCart()
  const hasLines = !!cart && cart.lines.nodes.length > 0

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={twMerge(
            'fixed inset-0 z-[100] bg-black/40',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <Dialog.Content
          className={twMerge(
            'fixed right-0 top-0 bottom-0 z-[100] w-full sm:max-w-md flex flex-col',
            'bg-white dark:bg-gray-950 shadow-xl border-l border-gray-200 dark:border-gray-800',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
          )}
          aria-describedby={undefined}
        >
          <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <Dialog.Title className="font-semibold">
              Cart{totalQuantity > 0 ? ` (${totalQuantity})` : ''}
            </Dialog.Title>
            <Dialog.Close
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900"
              aria-label="Close cart"
            >
              <X className="w-4 h-4" />
            </Dialog.Close>
          </header>

          {hasLines ? (
            <>
              <ul className="flex-1 overflow-y-auto px-6 divide-y divide-gray-200 dark:divide-gray-800">
                {cart.lines.nodes.map((line) => (
                  <DrawerCartLine
                    key={line.id}
                    line={line}
                    onClose={() => onOpenChange(false)}
                  />
                ))}
              </ul>
              <DrawerFooter cart={cart} onClose={() => onOpenChange(false)} />
            </>
          ) : (
            <DrawerEmpty onClose={() => onOpenChange(false)} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function DrawerEmpty({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <ShoppingCart className="w-10 h-10 text-gray-400" />
      <p className="text-gray-600 dark:text-gray-400">Your cart is empty.</p>
      <Link
        to="/shop"
        onClick={onClose}
        className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black font-semibold"
      >
        Shop all products
      </Link>
    </div>
  )
}

function DrawerFooter({
  cart,
  onClose,
}: {
  cart: NonNullable<ReturnType<typeof useCart>['cart']>
  onClose: () => void
}) {
  const subtotal = cart.cost.subtotalAmount
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 flex flex-col gap-3">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
        <span className="font-semibold">
          {formatMoney(subtotal.amount, subtotal.currencyCode)}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-500">
        Shipping and taxes calculated at checkout.
      </p>
      <a
        href={cart.checkoutUrl}
        className="w-full text-center px-6 py-3 rounded-lg bg-black text-white dark:bg-white dark:text-black font-semibold"
      >
        Checkout
      </a>
      <Link
        to="/shop/cart"
        onClick={onClose}
        className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:underline"
      >
        View cart
      </Link>
    </footer>
  )
}

function DrawerCartLine({
  line,
  onClose,
}: {
  line: CartLineDetail
  onClose: () => void
}) {
  const update = useUpdateCartLine()
  const remove = useRemoveCartLine()
  const { merchandise } = line
  const options = merchandise.selectedOptions
    .filter((o) => o.name.toLowerCase() !== 'title')
    .map((o) => `${o.name}: ${o.value}`)
    .join(' · ')

  const isBusy = update.isPending || remove.isPending

  return (
    <li className="flex gap-3 py-4">
      <Link
        to="/shop/products/$handle"
        params={{ handle: merchandise.product.handle }}
        onClick={onClose}
        className="shrink-0"
      >
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
          {merchandise.image ? (
            <img
              src={shopifyImageUrl(merchandise.image.url, {
                width: 160,
                format: 'webp',
              })}
              alt={merchandise.image.altText ?? merchandise.product.title}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
      </Link>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Link
          to="/shop/products/$handle"
          params={{ handle: merchandise.product.handle }}
          onClick={onClose}
          className="text-sm font-semibold hover:underline truncate"
        >
          {merchandise.product.title}
        </Link>
        {options ? (
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {options}
          </p>
        ) : null}
        <div className="flex items-center justify-between mt-1">
          <div className="inline-flex items-center rounded-md border border-gray-200 dark:border-gray-800 text-xs">
            <button
              type="button"
              onClick={() => {
                if (line.quantity <= 1) {
                  remove.mutate({ lineId: line.id })
                } else {
                  update.mutate({
                    lineId: line.id,
                    quantity: line.quantity - 1,
                  })
                }
              }}
              disabled={isBusy}
              aria-label="Decrease quantity"
              className="p-1.5 disabled:opacity-50"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="min-w-[1.5rem] text-center">{line.quantity}</span>
            <button
              type="button"
              onClick={() =>
                update.mutate({
                  lineId: line.id,
                  quantity: line.quantity + 1,
                })
              }
              disabled={isBusy}
              aria-label="Increase quantity"
              className="p-1.5 disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {formatMoney(
                line.cost.totalAmount.amount,
                line.cost.totalAmount.currencyCode,
              )}
            </span>
            <button
              type="button"
              onClick={() => remove.mutate({ lineId: line.id })}
              disabled={isBusy}
              aria-label="Remove from cart"
              className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
