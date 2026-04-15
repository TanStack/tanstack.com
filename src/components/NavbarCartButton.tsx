import { useLocation } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useCart } from '~/hooks/useCart'
import { useCartDrawerStore } from '~/components/shop/cartDrawerStore'

/**
 * Cart button in the main Navbar.
 *
 * Visibility rules:
 *   • Always visible on /shop/* routes (even at zero items)
 *   • Site-wide when the cart has at least one item
 *   • Hidden elsewhere when the cart is empty
 *
 * Click opens the global CartDrawer — no navigation, so the user keeps
 * their place in the docs or blog while reviewing their cart.
 */
export function NavbarCartButton() {
  const { pathname } = useLocation()
  const { totalQuantity } = useCart()
  const openDrawer = useCartDrawerStore((s) => s.openDrawer)
  const onShopRoute = pathname === '/shop' || pathname.startsWith('/shop/')

  if (!onShopRoute && totalQuantity === 0) return null

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={totalQuantity > 0 ? `Cart (${totalQuantity} items)` : 'Cart'}
      className={twMerge(
        'relative flex items-center justify-center',
        'h-9 w-9 rounded-lg transition-colors',
        'hover:bg-gray-500/10 text-gray-700 dark:text-gray-300',
      )}
    >
      <ShoppingCart className="w-4 h-4" />
      {totalQuantity > 0 ? (
        <span
          className={twMerge(
            'absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1',
            'flex items-center justify-center rounded-full',
            'text-[0.65rem] font-bold leading-none',
            'bg-black text-white dark:bg-white dark:text-black',
          )}
        >
          {totalQuantity > 99 ? '99+' : totalQuantity}
        </span>
      ) : null}
    </button>
  )
}
