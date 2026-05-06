import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import shopCss from '~/styles/shop.css?url'
import { ShopLayout } from '~/components/shop/ShopLayout'
import { CART_QUERY_KEY } from '~/hooks/useCart'
import { getCart } from '~/utils/shop.functions'
import { seo } from '~/utils/seo'

const SHOP_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500&display=swap'

export const Route = createFileRoute('/shop')({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: CART_QUERY_KEY,
      queryFn: () => getCart(),
    })
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
    Title: () => (
      <Link to="/shop" className="relative whitespace-nowrap">
        <span className="inline-block text-transparent bg-clip-text bg-linear-to-r from-blue-500 to-cyan-400">
          Shop
        </span>
      </Link>
    ),
  },
  component: () => (
    <ShopLayout>
      <Outlet />
    </ShopLayout>
  ),
})
