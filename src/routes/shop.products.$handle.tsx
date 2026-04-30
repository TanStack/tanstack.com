import * as React from 'react'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { ProductImage } from '~/components/shop/ProductImage'
import { useCartDrawerStore } from '~/components/shop/cartDrawerStore'
import { ShopNote } from '~/components/shop/ShopNote'
import { ShopSpecs } from '~/components/shop/ShopSpecs'
import {
  ShopChip,
  ShopCrumbs,
  ShopLabel,
  ShopMono,
  ShopPanel,
  ShopPulse,
  ShopQty,
  ShopSize,
} from '~/components/shop/ui'
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

  React.useEffect(() => {
    setActiveImageIndex(initialImageIndex)
  }, [initialImageIndex])

  const heroImage =
    product.images.nodes[activeImageIndex] ?? variantImage ?? null

  const displayPrice = selectedVariant?.price ?? null
  const inStock = !!selectedVariant?.availableForSale

  return (
    <div className="p-6 md:p-11 pb-24 max-w-[1200px] mx-auto">
      <ShopCrumbs
        crumbs={[{ label: 'Shop', href: '/shop' }, { label: product.title }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(320px,440px)] gap-8 md:gap-10 mt-6">
        <ProductGallery
          images={product.images.nodes}
          activeIndex={activeImageIndex}
          onChange={setActiveImageIndex}
          title={product.title}
          hero={heroImage}
        />

        <div className="flex flex-col">
          <ShopLabel>TanStack shop</ShopLabel>
          <h1 className="font-shop-display font-bold text-[32px] leading-[1.05] tracking-[-0.02em] text-shop-text mt-1.5">
            {product.title}
          </h1>

          <ShopPanel className="mt-3 p-3 flex flex-wrap items-center gap-2.5">
            {displayPrice ? (
              <ShopMono className="text-[20px] font-medium text-shop-text">
                {formatMoney(displayPrice.amount, displayPrice.currencyCode)}
              </ShopMono>
            ) : null}
            <ShopMono
              className={twMerge(
                'ml-auto flex items-center gap-1.5 text-[12px]',
                inStock ? 'text-shop-green' : 'text-shop-orange',
              )}
            >
              {inStock ? (
                <>
                  <ShopPulse />
                  In stock
                </>
              ) : (
                'Sold out'
              )}
            </ShopMono>
          </ShopPanel>

          <VariantSelector
            options={product.options}
            variants={variants}
            selected={selected}
            onChange={setSelected}
          />

          <QuantityAdd
            quantity={quantity}
            onChange={(n) => setQuantity(Math.max(1, n))}
            variant={selectedVariant}
            product={product}
          />

          {product.descriptionHtml ? (
            <ProductDescription html={product.descriptionHtml} />
          ) : null}

          <ShopSpecs
            specs={[
              { label: 'Ships', value: 'Worldwide, 7–10 days' },
              { label: 'From', value: 'TanStack' },
              { label: 'Condition', value: 'New' },
              {
                label: 'Variants',
                value: `${product.variants.nodes.length} in stock set`,
              },
            ]}
          />

          <ShopNote pill="TanStack">
            Official TanStack merch. Proceeds help fund maintainer time and keep
            all libraries free and open source.
          </ShopNote>

          <div className="mt-4.5 flex items-center justify-between">
            <ShopLabel>Keep browsing</ShopLabel>
            <Link
              to="/shop"
              className="text-shop-accent text-[11.5px] hover:underline"
            >
              All products →
            </Link>
          </div>
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
      <div className="aspect-square rounded-xl border border-shop-line bg-shop-panel" />
    )
  }
  const hasMultiple = images.length > 1
  return (
    <div>
      <div className="aspect-square rounded-xl border border-shop-line bg-shop-panel overflow-hidden">
        <ProductImage
          image={hero}
          alt={title}
          width={1200}
          sizes="(min-width: 768px) 60vw, 100vw"
          loading="eager"
        />
      </div>
      {hasMultiple ? (
        <div className="grid grid-cols-5 gap-1.5 mt-2.5">
          {images.slice(0, 5).map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => onChange(i)}
              aria-label={`View image ${i + 1} of ${images.length}`}
              aria-current={i === activeIndex}
              className={twMerge(
                'aspect-square rounded-md border bg-shop-panel overflow-hidden cursor-pointer transition-all',
                i === activeIndex
                  ? 'border-shop-accent shadow-[0_0_0_1px_var(--shop-accent)]'
                  : 'border-shop-line hover:border-shop-line-2',
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
        if (option.values.length <= 1) return null
        const isSizeOption = /size/i.test(option.name)
        return (
          <fieldset key={option.id} className="mt-4.5">
            <legend className="flex items-center justify-between w-full mb-2.5">
              <ShopLabel as="span">
                {option.name}
                <span className="ml-2 font-sans normal-case tracking-normal text-[11.5px] text-shop-text">
                  {selected[option.name]}
                </span>
              </ShopLabel>
            </legend>
            <div
              className={
                isSizeOption
                  ? 'grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-1.5'
                  : 'flex flex-wrap gap-2'
              }
            >
              {option.values.map((value) => {
                const isSelected = selected[option.name] === value
                const candidate = { ...selected, [option.name]: value }
                const match = findMatchingVariant(variants, candidate)
                const isUnavailable = !match?.availableForSale
                const handleClick = () =>
                  onChange({ ...selected, [option.name]: value })
                if (isSizeOption) {
                  return (
                    <ShopSize
                      key={value}
                      onClick={handleClick}
                      isSelected={isSelected}
                      isUnavailable={isUnavailable}
                    >
                      {value}
                    </ShopSize>
                  )
                }
                return (
                  <ShopChip
                    key={value}
                    onClick={handleClick}
                    isSelected={isSelected}
                    isUnavailable={isUnavailable}
                  >
                    {value}
                  </ShopChip>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </>
  )
}

function QuantityAdd({
  quantity,
  onChange,
  variant,
  product,
}: {
  quantity: number
  onChange: (next: number) => void
  variant: ProductDetailVariant | undefined
  product: ProductDetail
}) {
  const addToCart = useAddToCart()
  const openDrawer = useCartDrawerStore((s) => s.openDrawer)
  const [showAdded, setShowAdded] = React.useState(false)

  const disabled =
    !variant || !variant.availableForSale || (addToCart.isPending && !showAdded)
  const price = variant?.price

  const label = showAdded
    ? '✓ Added'
    : !variant
      ? 'Unavailable'
      : !variant.availableForSale
        ? 'Sold out'
        : price
          ? `Add to cart — ${formatMoney(
              (Number(price.amount) * quantity).toFixed(2),
              price.currencyCode,
            )}`
          : 'Add to cart'

  React.useEffect(() => {
    if (!showAdded) return
    const id = window.setTimeout(() => setShowAdded(false), 1500)
    return () => window.clearTimeout(id)
  }, [showAdded])

  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 mt-4.5">
      <ShopQty
        quantity={quantity}
        onChange={(n) => onChange(Math.max(1, n))}
        min={1}
      />
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
        className="
          h-10 flex items-center justify-center gap-2 rounded-md
          bg-shop-accent text-shop-accent-ink
          font-semibold text-[13px] tracking-[0.01em]
          transition-[filter] hover:enabled:brightness-110
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-shop-panel-2 disabled:text-shop-muted
          group
        "
      >
        {label}
        {!showAdded && variant?.availableForSale ? (
          <span className="transition-transform group-hover:translate-x-[3px]">
            →
          </span>
        ) : null}
      </button>
    </div>
  )
}

function ProductDescription({ html }: { html: string }) {
  return (
    <div
      className="
        mt-4 text-shop-text-2 text-[13.5px] leading-[1.6]
        [&_p]:my-0 [&_p]:mb-[0.9em] [&_a]:text-shop-accent [&_a]:underline
        [&_strong]:text-shop-text [&_strong]:font-semibold
        [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1
        [&_h1]:text-shop-text [&_h1]:font-shop-display [&_h1]:tracking-[-0.01em] [&_h1]:mt-5 [&_h1]:mb-1.5
        [&_h2]:text-shop-text [&_h2]:font-shop-display [&_h2]:tracking-[-0.01em] [&_h2]:mt-5 [&_h2]:mb-1.5
        [&_h3]:text-shop-text [&_h3]:font-shop-display [&_h3]:tracking-[-0.01em] [&_h3]:mt-5 [&_h3]:mb-1.5
      "
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
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

function ProductJsonLd({
  product,
  selectedVariant,
}: {
  product: ProductDetail
  selectedVariant: ProductDetailVariant | undefined
}) {
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

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export type { ProductDetail }
