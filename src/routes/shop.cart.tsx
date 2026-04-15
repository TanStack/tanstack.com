import { Link, createFileRoute } from '@tanstack/react-router'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useCart, useRemoveCartLine, useUpdateCartLine } from '~/hooks/useCart'
import { formatMoney, shopifyImageUrl } from '~/utils/shopify-format'
import type { CartLineDetail } from '~/utils/shopify-queries'

export const Route = createFileRoute('/shop/cart')({
  component: CartPage,
})

function CartPage() {
  const { cart } = useCart()

  // The parent /shop loader prefetches the cart into the React Query cache,
  // so this always renders with real data on the first frame.
  if (!cart || cart.lines.nodes.length === 0) return <EmptyCart />

  const { checkoutUrl, cost, lines, totalQuantity } = cart
  const subtotal = cost.subtotalAmount
  const total = cost.totalAmount

  return (
    <div className="flex flex-col max-w-4xl mx-auto gap-8 p-4 md:p-8">
      <header>
        <h1 className="text-3xl font-black">Cart</h1>
        <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
          {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-8">
        <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
          {lines.nodes.map((line) => (
            <CartLineRow key={line.id} line={line} />
          ))}
        </ul>

        <aside className="flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-6 h-fit">
          <h2 className="font-semibold">Summary</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Subtotal</dt>
              <dd>{formatMoney(subtotal.amount, subtotal.currencyCode)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-2 font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(total.amount, total.currencyCode)}</dd>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Shipping and taxes calculated at checkout.
            </p>
          </dl>
          <a
            href={checkoutUrl}
            className="w-full text-center px-6 py-3 rounded-lg bg-black text-white dark:bg-white dark:text-black font-semibold"
          >
            Checkout
          </a>
          <Link
            to="/shop"
            className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:underline"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="flex flex-col max-w-4xl mx-auto gap-8 p-4 md:p-8">
      <header>
        <h1 className="text-3xl font-black">Cart</h1>
      </header>
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <ShoppingCart className="w-10 h-10 text-gray-400" />
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Your cart is empty.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black font-semibold"
        >
          Shop all products
        </Link>
      </div>
    </div>
  )
}

function CartLineRow({ line }: { line: CartLineDetail }) {
  const update = useUpdateCartLine()
  const remove = useRemoveCartLine()
  const { merchandise } = line
  const options = merchandise.selectedOptions
    .filter((o) => o.name.toLowerCase() !== 'title')
    .map((o) => `${o.name}: ${o.value}`)
    .join(' · ')

  const isBusy = update.isPending || remove.isPending

  return (
    <li className="flex gap-4 py-6">
      <Link
        to="/shop/products/$handle"
        params={{ handle: merchandise.product.handle }}
        className="shrink-0"
      >
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
          {merchandise.image ? (
            <img
              src={shopifyImageUrl(merchandise.image.url, {
                width: 200,
                format: 'webp',
              })}
              alt={merchandise.image.altText ?? merchandise.product.title}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
      </Link>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/shop/products/$handle"
              params={{ handle: merchandise.product.handle }}
              className="font-semibold hover:underline"
            >
              {merchandise.product.title}
            </Link>
            {options ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {options}
              </p>
            ) : null}
          </div>
          <div className="text-sm font-semibold shrink-0">
            {formatMoney(
              line.cost.totalAmount.amount,
              line.cost.totalAmount.currencyCode,
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <QuantityStepper
            quantity={line.quantity}
            onChange={(next) => {
              if (next <= 0) {
                remove.mutate({ lineId: line.id })
              } else {
                update.mutate({ lineId: line.id, quantity: next })
              }
            }}
            disabled={isBusy}
          />
          <button
            type="button"
            onClick={() => remove.mutate({ lineId: line.id })}
            disabled={isBusy}
            aria-label="Remove from cart"
            className={twMerge(
              'p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  )
}

function QuantityStepper({
  quantity,
  onChange,
  disabled,
}: {
  quantity: number
  onChange: (next: number) => void
  disabled?: boolean
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-800">
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        disabled={disabled}
        aria-label="Decrease quantity"
        className="p-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center text-sm font-medium">{quantity}</span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={disabled}
        aria-label="Increase quantity"
        className="p-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
