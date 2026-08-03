import { createFileRoute, notFound } from '@tanstack/react-router'
import { ProductPage } from './shop.products.$handle'
import { getProduct } from '~/utils/shop.functions'
import { shopifyImageUrl } from '~/utils/shopify-format'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/shop/$handle')({
  loader: async ({ params }) => {
    const product = await getProduct({ data: { handle: params.handle } })
    if (!product) throw notFound()
    return { product }
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product
    if (!product) return { meta: [] }
    const ogImage = product.images.nodes[0]
    return {
      meta: seo({
        title: `${product.seo.title ?? product.title} | TanStack Shop`,
        description: product.seo.description ?? undefined,
        image: ogImage
          ? shopifyImageUrl(ogImage.url, {
              width: 1200,
              height: 630,
              format: 'jpg',
              crop: 'center',
            })
          : undefined,
      }),
    }
  },
  component: ShopProductPageRoute,
})

function ShopProductPageRoute() {
  const { product } = Route.useLoaderData()
  return (
    <ProductPage product={product} canonicalPath={`/shop/${product.handle}`} />
  )
}
