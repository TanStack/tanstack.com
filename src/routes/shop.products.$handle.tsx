import * as React from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { Minus, Plus } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { Breadcrumbs } from '~/components/shop/Breadcrumbs'
import { ProductImage } from '~/components/shop/ProductImage'
import { useCartDrawerStore } from '~/components/shop/cartDrawerStore'
import { useAddToCart } from '~/hooks/useCart'
import { getProduct } from '~/utils/shop.functions'
import {
  type ProductDetail,
  type ProductDetailVariant,
} from '~/utils/shopify-queries'
import { formatMoney, shopifyImageUrl } from '~/utils/shopify-format'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/shop/products/$handle')({
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
  component: ProductPage,
})

function ProductPage() {
  const { product } = Route.useLoaderData()
  const variants = product.variants.nodes

  const [selected, setSelected] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(product.options.map((o) => [o.name, o.values[0]!])),
  )
  const [quantity, setQuantity] = React.useState(1)

  const selectedVariant = findMatchingVariant(variants, selected)

  // Use the variant's image if it has one, else the first product image
  const variantImage = selectedVariant?.image ?? null
  const initialImageIndex = React.useMemo(() => {
    if (!variantImage) return 0
    const i = product.images.nodes.findIndex(
      (img) => img.url === variantImage.url,
    )
    return i >= 0 ? i : 0
  }, [variantImage, product.images.nodes])
  const [activeImageIndex, setActiveImageIndex] =
    React.useState(initialImageIndex)

  // Keep gallery in sync when the selected variant swaps its image
  React.useEffect(() => {
    setActiveImageIndex(initialImageIndex)
  }, [initialImageIndex])

  const heroImage =
    product.images.nodes[activeImageIndex] ?? variantImage ?? null

  const displayPrice = selectedVariant?.price ?? null

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 flex flex-col gap-6">
      <Breadcrumbs
        crumbs={[{ label: 'Shop', href: '/shop' }, { label: product.title }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        <ProductGallery
          images={product.images.nodes}
          activeIndex={activeImageIndex}
          onChange={setActiveImageIndex}
          title={product.title}
          hero={heroImage}
        />

        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-black">{product.title}</h1>
            {displayPrice ? (
              <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">
                {formatMoney(displayPrice.amount, displayPrice.currencyCode)}
              </p>
            ) : null}
          </header>

          <VariantSelector
            options={product.options}
            variants={variants}
            selected={selected}
            onChange={setSelected}
          />

          <QuantityStepper
            quantity={quantity}
            onChange={(n) => setQuantity(Math.max(1, n))}
          />

          <AddToCartButton
            variant={selectedVariant}
            quantity={quantity}
            product={product}
          />

          {product.descriptionHtml ? (
            <div
              className="prose dark:prose-invert max-w-none mt-4"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          ) : null}
        </div>
      </div>

      <ProductJsonLd product={product} selectedVariant={selectedVariant} />
    </div>
  )
}

type ProductGalleryImage = ProductDetail['images']['nodes'][number]

function ProductGallery({
  images,
  activeIndex,
  onChange,
  title,
  hero,
}: {
  images: Array<ProductGalleryImage>
  activeIndex: number
  onChange: (i: number) => void
  title: string
  hero: ProductGalleryImage | null
}) {
  if (!hero) {
    return (
      <div className="aspect-square rounded-2xl bg-gray-100 dark:bg-gray-900" />
    )
  }
  const hasMultiple = images.length > 1
  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-900">
        <ProductImage
          image={hero}
          alt={title}
          width={1200}
          sizes="(min-width: 768px) 50vw, 100vw"
          loading="eager"
        />
      </div>
      {hasMultiple ? (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => onChange(i)}
              aria-label={`View image ${i + 1} of ${images.length}`}
              aria-current={i === activeIndex}
              className={twMerge(
                'aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900 transition-all',
                i === activeIndex
                  ? 'ring-2 ring-black dark:ring-white'
                  : 'opacity-70 hover:opacity-100',
              )}
            >
              <ProductImage
                image={img}
                alt={`${title} thumbnail ${i + 1}`}
                width={160}
                sizes="20vw"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function VariantSelector({
  options,
  variants,
  selected,
  onChange,
}: {
  options: ProductDetail['options']
  variants: Array<ProductDetailVariant>
  selected: Record<string, string>
  onChange: (next: Record<string, string>) => void
}) {
  return (
    <>
      {options.map((option) => {
        // Skip auto-generated single-value options like "Title: Default Title"
        if (option.values.length <= 1) return null
        return (
          <fieldset key={option.id} className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
              <span>{option.name}</span>
              <span className="ml-2 text-gray-500 dark:text-gray-400">
                {selected[option.name]}
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const isSelected = selected[option.name] === value
                // Would this value + current selections resolve to an
                // available variant? Drives disabled styling without
                // preventing clicks (Shopify themes tend to allow clicks
                // so users can see the sold-out state).
                const candidate = { ...selected, [option.name]: value }
                const match = findMatchingVariant(variants, candidate)
                const isAvailable = !!match?.availableForSale

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      onChange({ ...selected, [option.name]: value })
                    }
                    aria-pressed={isSelected}
                    className={twMerge(
                      'px-4 py-2 rounded-lg border text-sm transition-colors relative',
                      isSelected
                        ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-500',
                      !isAvailable && !isSelected
                        ? 'opacity-50 line-through decoration-gray-400'
                        : '',
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
    </>
  )
}

function QuantityStepper({
  quantity,
  onChange,
}: {
  quantity: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Quantity</span>
      <div className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-700 w-fit">
        <button
          type="button"
          onClick={() => onChange(quantity - 1)}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
          className="p-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-10 text-center text-sm font-medium">{quantity}</span>
        <button
          type="button"
          onClick={() => onChange(quantity + 1)}
          aria-label="Increase quantity"
          className="p-2"
        >
          <Plus className="w-4 h-4" />
        </button>
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
  quantity,
  product,
}: {
  variant: ProductDetailVariant | undefined
  quantity: number
  product: ProductDetail
}) {
  const addToCart = useAddToCart()
  const openDrawer = useCartDrawerStore((s) => s.openDrawer)
  const [showAdded, setShowAdded] = React.useState(false)

  const disabled =
    !variant || !variant.availableForSale || (addToCart.isPending && !showAdded)

  const label = showAdded
    ? 'Added ✓'
    : !variant
      ? 'Unavailable'
      : !variant.availableForSale
        ? 'Sold out'
        : 'Add to cart'

  // Reset the "Added ✓" confirmation after a moment
  React.useEffect(() => {
    if (!showAdded) return
    const id = window.setTimeout(() => setShowAdded(false), 1500)
    return () => window.clearTimeout(id)
  }, [showAdded])

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!variant) return
          setShowAdded(true)
          openDrawer()
          addToCart.mutate({
            variantId: variant.id,
            quantity,
            line: {
              productTitle: product.title,
              productHandle: product.handle,
              variantTitle: variant.title,
              price: variant.price,
              image: variant.image,
              selectedOptions: variant.selectedOptions,
            },
          })
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

/**
 * schema.org Product JSON-LD for rich search results. Shopify's Storefront
 * API already returns availability and pricing; we just reshape it.
 */
function ProductJsonLd({
  product,
  selectedVariant,
}: {
  product: ProductDetail
  selectedVariant: ProductDetailVariant | undefined
}) {
  const firstImage = product.images.nodes[0]
  const offers = product.variants.nodes.map((v) => ({
    '@type': 'Offer',
    sku: v.id,
    price: v.price.amount,
    priceCurrency: v.price.currencyCode,
    availability: v.availableForSale
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    url: `https://tanstack.com/shop/products/${product.handle}`,
  }))

  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.title,
    description: product.seo.description ?? undefined,
    image: product.images.nodes.map((img) => img.url),
    sku: selectedVariant?.id,
    offers:
      offers.length === 1
        ? offers[0]
        : {
            '@type': 'AggregateOffer',
            offerCount: offers.length,
            lowPrice: Math.min(
              ...product.variants.nodes.map((v) => Number(v.price.amount)),
            ),
            highPrice: Math.max(
              ...product.variants.nodes.map((v) => Number(v.price.amount)),
            ),
            priceCurrency:
              product.variants.nodes[0]?.price.currencyCode ?? 'USD',
            offers,
          },
  }

  // void-used just to keep TS happy about firstImage
  void firstImage

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export type { ProductDetail }
