import * as React from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { getProduct } from '~/utils/shop.functions'
import type {
  ProductDetail,
  ProductDetailVariant,
} from '~/utils/shopify-queries'
import { formatMoney, shopifyImageUrl } from '~/utils/shopify-format'
import { seo } from '~/utils/seo'
import { twMerge } from 'tailwind-merge'
import { useAddToCart } from '~/hooks/useCart'

export const Route = createFileRoute('/shop/products/$handle')({
  loader: async ({ params }) => {
    const product = await getProduct({ data: { handle: params.handle } })
    if (!product) throw notFound()
    return { product }
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product
    if (!product) return { meta: [] }
    return {
      meta: seo({
        title: `${product.seo.title ?? product.title} | TanStack Shop`,
        description: product.seo.description ?? undefined,
      }),
    }
  },
  component: ProductPage,
})

function ProductPage() {
  const { product } = Route.useLoaderData()
  const [selected, setSelected] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(product.options.map((o) => [o.name, o.values[0]!])),
  )

  const selectedVariant = findMatchingVariant(product.variants.nodes, selected)
  const displayPrice = selectedVariant?.price ?? null

  // Use the variant's image if it has one, else fall back to the first product image
  const heroImage = selectedVariant?.image ?? product.images.nodes[0] ?? null

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        <div className="aspect-square overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-900">
          {heroImage ? (
            <img
              src={shopifyImageUrl(heroImage.url, {
                width: 1200,
                format: 'webp',
              })}
              alt={heroImage.altText ?? product.title}
              width={heroImage.width ?? undefined}
              height={heroImage.height ?? undefined}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-black">{product.title}</h1>
            {displayPrice ? (
              <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">
                {formatMoney(displayPrice.amount, displayPrice.currencyCode)}
              </p>
            ) : null}
          </header>

          {product.options.map((option) => {
            // Skip auto-generated single-value options like "Title: Default Title"
            if (option.values.length <= 1) return null
            return (
              <fieldset key={option.id} className="flex flex-col gap-2">
                <legend className="text-sm font-medium">{option.name}</legend>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const isSelected = selected[option.name] === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setSelected((prev) => ({
                            ...prev,
                            [option.name]: value,
                          }))
                        }
                        className={twMerge(
                          'px-4 py-2 rounded-lg border text-sm transition-colors',
                          isSelected
                            ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                            : 'border-gray-300 dark:border-gray-700 hover:border-gray-500',
                        )}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}

          <AddToCartButton variant={selectedVariant} />

          {product.descriptionHtml ? (
            <div
              className="prose dark:prose-invert max-w-none mt-4"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function findMatchingVariant(
  variants: Array<ProductDetailVariant>,
  selected: Record<string, string>,
): ProductDetailVariant | undefined {
  return variants.find((v) =>
    v.selectedOptions.every((opt) => selected[opt.name] === opt.value),
  )
}

function AddToCartButton({
  variant,
}: {
  variant: ProductDetailVariant | undefined
}) {
  const addToCart = useAddToCart()

  const disabled = !variant || !variant.availableForSale || addToCart.isPending

  const label = addToCart.isSuccess
    ? 'Added ✓'
    : addToCart.isPending
      ? 'Adding…'
      : !variant
        ? 'Unavailable'
        : !variant.availableForSale
          ? 'Sold out'
          : 'Add to cart'

  // Reset the "Added ✓" confirmation after a moment so repeat adds feel fresh
  React.useEffect(() => {
    if (!addToCart.isSuccess) return
    const id = window.setTimeout(() => addToCart.reset(), 1500)
    return () => window.clearTimeout(id)
  }, [addToCart.isSuccess, addToCart])

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!variant) return
          addToCart.mutate({ variantId: variant.id, quantity: 1 })
        }}
        className={twMerge(
          'mt-2 px-6 py-3 rounded-lg font-semibold transition-colors',
          'bg-black text-white dark:bg-white dark:text-black',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {label}
      </button>
      {addToCart.isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {addToCart.error instanceof Error
            ? addToCart.error.message
            : 'Could not add to cart. Please try again.'}
        </p>
      ) : null}
    </div>
  )
}

export type { ProductDetail }
