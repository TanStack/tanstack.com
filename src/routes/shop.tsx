import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import shopCss from '~/styles/shop.css?url'
import { ShopLayout } from '~/components/shop/ShopLayout'
import { CART_QUERY_KEY } from '~/hooks/useCart'
import {
  getCart,
  getCollections,
  getShopPolicies,
} from '~/utils/shop.functions'
import { seo } from '~/utils/seo'

const SHOP_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500&display=swap'

export const Route = createFileRoute('/shop')({
  loader: async ({ context }) => {
    // Fetch collections + policies for the sidebar, and pre-seed the cart
    // into the React Query cache so any /shop child page (including the
    // cart page) renders with real data on the very first frame.
    const [collections, policies] = await Promise.all([
      getCollections(),
      getShopPolicies(),
      context.queryClient.prefetchQuery({
        queryKey: CART_QUERY_KEY,
        queryFn: () => getCart(),
      }),
    ])
    return { collections, policies }
  },
  head: () => ({
    meta: seo({
      title: 'TanStack Shop',
      description:
        'Official TanStack apparel, accessories, and stickers. Show your support and rep your favorite open-source toolkit.',
    }),
    links: [
      { rel: 'stylesheet', href: shopCss },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: SHOP_FONTS_HREF },
    ],
  }),
  staticData: {
    // Providing a Title flips the main Navbar into flyout mode so the shop
    // sidebar takes over the primary left rail (same behavior as doc pages).
    Title: () => (
      <Link to="/shop" className="relative whitespace-nowrap">
        <span className="inline-block text-transparent bg-clip-text bg-linear-to-r from-blue-500 to-cyan-400">
          Shop
        </span>
      </Link>
    ),
  },
  component: ShopRoute,
})

function ShopRoute() {
  const { collections, policies } = Route.useLoaderData()
  return (
    <ShopLayout collections={collections} policies={policies}>
      <Outlet />
    </ShopLayout>
  )
}
