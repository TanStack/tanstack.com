import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ShoppingCart, Trash2, X } from 'lucide-react'
import {
  ShopButton,
  ShopCrumbs,
  ShopInput,
  ShopLabel,
  ShopMono,
  ShopPanel,
  ShopQty,
} from '~/components/shop/ui'
import {
  useApplyDiscountCode,
  useCart,
  useRemoveCartLine,
  useRemoveDiscountCode,
  useUpdateCartLine,
} from '~/hooks/useCart'
import { formatMoney, shopifyImageUrl } from '~/utils/shopify-format'
import type { CartDetail, CartLineDetail } from '~/utils/shopify-queries'

export const Route = createFileRoute('/shop/cart')({
  component: CartPage,
})

function CartPage() {
  const { cart } = useCart()
  if (!cart || cart.lines.nodes.length === 0) return <EmptyCart />

  const { checkoutUrl, cost, lines, totalQuantity } = cart
  const subtotal = cost.subtotalAmount
  const total = cost.totalAmount

  return (
    <div className="p-6 md:p-11 pb-24 max-w-[1100px] mx-auto flex flex-col gap-6">
      <ShopCrumbs
        crumbs={[{ label: 'Shop', href: '/shop' }, { label: 'Cart' }]}
      />
      <header>
        <h1 className="font-shop-display font-bold text-[36px] leading-[1.05] tracking-[-0.02em] text-shop-text">
          Cart
        </h1>
        <ShopLabel className="mt-2">
          {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
        </ShopLabel>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <ul className="flex flex-col">
          {lines.nodes.map((line) => (
            <CartLineRow key={line.id} line={line} />
          ))}
        </ul>

        <ShopPanel className="p-5 h-fit flex flex-col gap-3.5">
          <ShopLabel>Summary</ShopLabel>

          <DiscountCodeSection cart={cart} />

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between text-shop-text-2">
              <dt>Subtotal</dt>
              <dd>
                <ShopMono>
                  {formatMoney(subtotal.amount, subtotal.currencyCode)}
                </ShopMono>
              </dd>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t border-shop-line text-shop-text">
              <dt>Total</dt>
              <dd>
                <ShopMono>
                  {formatMoney(total.amount, total.currencyCode)}
                </ShopMono>
              </dd>
            </div>
            <p className="font-shop-mono text-[11px] text-shop-muted tracking-[0.06em] mt-1">
              Shipping and taxes calculated at checkout.
            </p>
          </dl>

          <a
            href={checkoutUrl}
            className="
              w-full h-11 rounded-md bg-shop-accent text-shop-accent-ink
              font-semibold text-[13px] flex items-center justify-center gap-2
              transition-[filter] hover:brightness-110 group
            "
          >
            Checkout
            <span className="transition-transform group-hover:translate-x-[3px]">
              →
            </span>
          </a>
          <Link
            to="/shop"
            className="text-center text-sm text-shop-text-2 hover:underline"
          >
            Continue shopping
          </Link>
        </ShopPanel>
      </div>
    </div>
  )
}

function DiscountCodeSection({ cart }: { cart: CartDetail }) {
  const apply = useApplyDiscountCode()
  const remove = useRemoveDiscountCode()
  const [input, setInput] = React.useState('')

  const applied = cart.discountCodes.filter((c) => c.applicable)

  React.useEffect(() => {
    if (apply.isSuccess) {
      setInput('')
      apply.reset()
    }
  }, [apply.isSuccess, apply])

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-shop-line">
      {applied.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {applied.map((d) => (
            <li
              key={d.code}
              className="flex items-center justify-between text-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <ShopMono className="px-2 py-0.5 rounded bg-shop-panel-2 text-shop-text text-xs">
                  {d.code}
                </ShopMono>
                <span className="text-xs text-shop-muted">applied</span>
              </span>
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                aria-label={`Remove discount ${d.code}`}
                className="p-1 rounded-md text-shop-muted hover:text-shop-text disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const code = input.trim()
            if (code) apply.mutate({ code })
          }}
          className="flex items-center gap-2"
        >
          <ShopInput
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Discount code"
            className="flex-1"
          />
          <ShopButton
            type="submit"
            disabled={apply.isPending || input.trim().length === 0}
          >
            {apply.isPending ? 'Applying…' : 'Apply'}
          </ShopButton>
        </form>
      )}
      {apply.isError ? (
        <p className="text-xs text-shop-orange">
          {apply.error instanceof Error
            ? apply.error.message
            : 'Could not apply discount.'}
        </p>
      ) : null}
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="p-6 md:p-11 pb-24 max-w-[1100px] mx-auto flex flex-col gap-8">
      <header>
        <h1 className="font-shop-display font-bold text-[36px] leading-[1.05] tracking-[-0.02em] text-shop-text">
          Cart
        </h1>
      </header>
      <div className="flex flex-col items-center gap-4 py-16 text-center text-shop-text-2">
        <ShoppingCart className="w-10 h-10 text-shop-muted" />
        <p>Your cart is empty.</p>
        <Link
          to="/shop"
          className="
            inline-flex items-center gap-2 px-4 py-2.5 rounded-md
            bg-shop-accent text-shop-accent-ink
            font-semibold text-[13px]
            transition-[filter] hover:brightness-110 group
          "
        >
          Shop all products
          <span className="transition-transform group-hover:translate-x-[3px]">
            →
          </span>
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
    <li className="flex gap-4 py-5 border-b border-shop-line items-start">
      <Link
        to="/shop/products/$handle"
        params={{ handle: merchandise.product.handle }}
        className="shrink-0 w-24 h-24 rounded-lg border border-shop-line bg-shop-panel overflow-hidden"
      >
        {merchandise.image ? (
          <img
            src={shopifyImageUrl(merchandise.image.url, {
              width: 200,
              format: 'webp',
            })}
            alt={merchandise.image.altText ?? merchandise.product.title}
            className="w-full h-full object-cover"
          />
        ) : null}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/shop/products/$handle"
              params={{ handle: merchandise.product.handle }}
              className="font-semibold text-shop-text hover:underline"
            >
              {merchandise.product.title}
            </Link>
            {options ? (
              <ShopMono className="block text-xs text-shop-muted mt-1">
                {options}
              </ShopMono>
            ) : null}
          </div>
          <ShopMono className="shrink-0 font-medium text-shop-text">
            {formatMoney(
              line.cost.totalAmount.amount,
              line.cost.totalAmount.currencyCode,
            )}
          </ShopMono>
        </div>

        <div className="flex items-center justify-between mt-1">
          <ShopQty
            quantity={line.quantity}
            onChange={(next) => {
              if (next <= 0) remove.mutate({ lineId: line.id })
              else update.mutate({ lineId: line.id, quantity: next })
            }}
            disabled={isBusy}
          />
          <button
            type="button"
            onClick={() => remove.mutate({ lineId: line.id })}
            disabled={isBusy}
            aria-label="Remove from cart"
            className="p-2 rounded-md text-shop-muted hover:text-shop-text disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  )
}
