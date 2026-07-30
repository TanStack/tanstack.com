import { Outlet, createFileRoute } from '@tanstack/react-router'
import shopCss from '~/styles/shop.css?url'
import { ShopLayout } from '~/components/shop/ShopLayout'
import { CART_QUERY_KEY } from '~/hooks/useCart'
import { getCart } from '~/utils/shop.functions'

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
  component: () => (
    <ShopLayout>
      <Outlet />
    </ShopLayout>
  ),
})
