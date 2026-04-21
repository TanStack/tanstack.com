import { Link } from '@tanstack/react-router'
import { ProductImage } from './ProductImage'
import { ShopBadge, ShopMono } from './ui'
import { formatMoney } from '~/utils/shopify-format'
import type { ProductListItem } from '~/utils/shopify-queries'

type ProductCardProps = {
  product: ProductListItem
  sizes?: string
  loading?: 'eager' | 'lazy'
}

/**
 * Grid tile for a product. Editorial styling via Tailwind utilities:
 * stripe-lined image well, hover quick-view chip, mono caption tag,
 * JetBrains Mono price. New/Sale/Low-stock badges derived from tags.
 */
export function ProductCard({
  product,
  sizes,
  loading = 'lazy',
}: ProductCardProps) {
  const { minVariantPrice, maxVariantPrice } = product.priceRange
  const compareAt = product.compareAtPriceRange?.minVariantPrice
  const isRange = minVariantPrice.amount !== maxVariantPrice.amount
  const isDiscounted =
    compareAt && Number(compareAt.amount) > Number(minVariantPrice.amount)

  const isNew = product.tags?.some((t) => t.toLowerCase() === 'new')
  const isLowStock = product.tags?.some(
    (t) => t.toLowerCase() === 'low-stock' || t.toLowerCase() === 'low stock',
  )

  const tag = product.productType || product.tags?.[0] || ''

  return (
    <Link
      to="/shop/products/$handle"
      params={{ handle: product.handle }}
      className="
        group flex flex-col gap-2.5 rounded-xl border border-shop-line bg-shop-panel p-2.5
        transition-[border-color,transform] duration-200
        hover:border-shop-line-2 hover:-translate-y-0.5
      "
    >
      <div className="relative aspect-square rounded-lg overflow-hidden bg-shop-panel-2">
        {/* Diagonal stripe texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 [background:repeating-linear-gradient(45deg,transparent_0_12px,color-mix(in_srgb,var(--shop-text)_2%,transparent)_12px_13px)]"
        />
        {/* Soft accent glow */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_50%,color-mix(in_srgb,var(--shop-accent)_8%,transparent),transparent_70%)]"
        />
        {/* Image */}
        <ProductImage
          image={product.featuredImage}
          alt={product.title}
          width={600}
          sizes={sizes}
          loading={loading}
          className="relative z-[1]"
        />

        {/* Badges */}
        {isNew || isLowStock || isDiscounted ? (
          <div className="absolute top-2.5 left-2.5 flex gap-1 z-[2]">
            {isNew ? <ShopBadge variant="new">New</ShopBadge> : null}
            {isDiscounted ? <ShopBadge variant="sale">Sale</ShopBadge> : null}
            {isLowStock ? (
              <ShopBadge variant="sale">Low stock</ShopBadge>
            ) : null}
          </div>
        ) : null}

        {/* Category tag (hidden on hover, replaced by quick-view chip) */}
        {tag ? (
          <span
            className="
              absolute bottom-2.5 right-2.5 z-[1]
              font-shop-mono text-[9.5px] tracking-[0.1em] uppercase
              text-shop-muted bg-shop-bg-2/80 backdrop-blur
              border border-shop-line-2 rounded px-1.5 py-[3px]
              max-w-[calc(100%-1.25rem)] overflow-hidden text-ellipsis whitespace-nowrap
              transition-opacity group-hover:opacity-0
            "
          >
            {tag}
          </span>
        ) : null}

        {/* Quick view chip */}
        <span
          className="
            absolute bottom-2.5 right-2.5 z-[2]
            inline-flex items-center gap-1 px-2 py-[5px] rounded-md
            bg-shop-accent text-shop-accent-ink text-[11px] font-semibold
            opacity-0 translate-y-1 pointer-events-none
            transition-all group-hover:opacity-100 group-hover:translate-y-0
          "
        >
          Quick view
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M2 5h6M6 2l3 3-3 3"
              stroke="currentColor"
              strokeWidth="1.6"
              fill="none"
            />
          </svg>
        </span>
      </div>

      <div className="flex justify-between items-baseline gap-2.5 px-1 pb-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold tracking-[-0.005em] leading-tight text-shop-text truncate">
            {product.title}
          </div>
          {tag ? (
            <ShopMono className="block text-[11.5px] text-shop-muted tracking-[0.02em] mt-0.5 truncate">
              {tag}
            </ShopMono>
          ) : null}
        </div>
        <ShopMono className="text-[12.5px] text-shop-text whitespace-nowrap">
          {isRange ? 'From ' : ''}
          {formatMoney(minVariantPrice.amount, minVariantPrice.currencyCode)}
          {isDiscounted ? (
            <span className="ml-1.5 text-[11px] text-shop-muted line-through">
              {formatMoney(compareAt.amount, compareAt.currencyCode)}
            </span>
          ) : null}
        </ShopMono>
      </div>
    </Link>
  )
}
