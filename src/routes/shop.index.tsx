import { Link, createFileRoute } from '@tanstack/react-router'
import { getProducts } from '~/utils/shop.functions'
import type { ProductListItem } from '~/utils/shopify-queries'
import { formatMoney, shopifyImageUrl } from '~/utils/shopify-format'

export const Route = createFileRoute('/shop/')({
  loader: async () => {
    const products = await getProducts()
    return { products }
  },
  component: ShopIndex,
})

function ShopIndex() {
  const { products } = Route.useLoaderData()
  return (
    <div className="flex flex-col max-w-6xl mx-auto gap-8 p-4 md:p-8">
      <header>
        <h1 className="text-3xl font-black">All Products</h1>
        <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
          {products.length} {products.length === 1 ? 'product' : 'products'}
        </p>
      </header>

      {products.length === 0 ? (
        <div className="text-center py-24 text-gray-500">
          No products yet. Check back soon!
        </div>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      )}
    </div>
  )
}

function ProductCard({ product }: { product: ProductListItem }) {
  const price = product.priceRange.minVariantPrice
  const image = product.featuredImage
  return (
    <Link
      to="/shop/products/$handle"
      params={{ handle: product.handle }}
      className="group flex flex-col gap-3"
    >
      <div className="aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-900">
        {image ? (
          <img
            src={shopifyImageUrl(image.url, { width: 600, format: 'webp' })}
            alt={image.altText ?? product.title}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">{product.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {formatMoney(price.amount, price.currencyCode)}
        </p>
      </div>
    </Link>
  )
}
