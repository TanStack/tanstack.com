import { Outlet, createFileRoute } from '@tanstack/react-router'
import shopCss from '~/styles/shop.css?url'
import { ShopLayout } from '~/components/shop/ShopLayout'
import { CART_QUERY_KEY } from '~/hooks/useCart'
import { getCart, isShopConfigured } from '~/utils/shop.functions'

export const Route = createFileRoute('/shop')({
  loader: async ({ context }) => {
    const configured = await isShopConfigured()
    await context.queryClient.prefetchQuery({
      queryKey: CART_QUERY_KEY,
      queryFn: () => getCart(),
    })
    return { configured }
  },
  head: () => ({
    links: [
      // shop.css also holds the self-hosted DM Sans and JetBrains Mono faces.
      { rel: 'stylesheet', href: shopCss },
    ],
  }),
  component: Shop,
})

function Shop() {
  const { configured } = Route.useLoaderData()
  return configured ? (
    <ShopLayout>
      <Outlet />
    </ShopLayout>
  ) : (
    <main className="mx-auto max-w-xl px-6 py-20">
      <p>The shop isn't configured for this server.</p>
      <a href="https://tanstack.com/shop">Browse the live shop</a>
    </main>
  )
}
