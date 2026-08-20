import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ProductImage } from './ProductImage'
import { ShopBadge, ShopMono } from './ui'
import { formatMoney, shopifyImageUrl } from '~/utils/shopify-format'
import type { ProductListItem } from '~/utils/shopify-queries'
import { resolveShopProductColor } from '~/utils/shop-color'

function NewBadge() {
  return (
    <ShopBadge
      variant="new"
      className="absolute bottom-3 left-3 z-[2] h-5 rounded-full px-2.5 leading-none"
    >
      New
    </ShopBadge>
  )
}

type ProductCardProps = {
  product: ProductListItem
  isNew?: boolean
  loading?: 'eager' | 'lazy'
  onQuickView?: (handle: string) => void
}

export function ProductCard({
  product,
  isNew = false,
  loading = 'lazy',
  onQuickView,
}: ProductCardProps) {
  const { minVariantPrice, maxVariantPrice } = product.priceRange
  const compareAt = product.compareAtPriceRange?.minVariantPrice
  const isRange = minVariantPrice.amount !== maxVariantPrice.amount

  const colorOption = product.options?.find((o) => /colou?r/i.test(o.name))
  const swatches = colorOption
    ? colorOption.values.slice(0, 6).map((v) => ({
        name: v,
        hex: resolveShopProductColor(v),
      }))
    : []

  const [hoveredColor, setHoveredColor] = React.useState<string | null>(null)

  // Preload all color-variant images on mount so hover swaps are instant
  React.useEffect(() => {
    if (!colorOption) return
    const seen = new Set<string>()
    for (const v of product.variants.nodes) {
      if (!v.image?.url || seen.has(v.image.url)) continue
      seen.add(v.image.url)
      const img = new Image()
      img.src = shopifyImageUrl(v.image.url, { width: 600, format: 'webp' })
    }
  }, [colorOption, product.variants.nodes])

  const activeImage = React.useMemo(() => {
    if (!hoveredColor || !colorOption) return product.featuredImage
    const variant = product.variants.nodes.find((v) =>
      v.selectedOptions.some(
        (o) => /colou?r/i.test(o.name) && o.value === hoveredColor,
      ),
    )
    return variant?.image ?? product.featuredImage
  }, [hoveredColor, colorOption, product])

  const cardBody = (
    <div
      className="
        shop-product-card group flex flex-col min-w-[340px] max-w-[400px] w-full rounded-xl
        border border-transparent bg-transparent
        hover:border-shop-line-2
        transition-[border-color,background-color] duration-200 motion-reduce:transition-none
        px-[22px] pt-7 pb-5
      "
    >
      {/* Image */}
      <div className="relative aspect-square rounded-lg overflow-hidden">
        <ProductImage
          image={activeImage}
          alt={product.title}
          width={600}
          loading={loading}
          className="w-full h-full object-cover"
        />
        {isNew ? <NewBadge /> : null}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-2.5 pt-4">
        {/* Title + price */}
        <div className="flex justify-between items-baseline gap-3">
          <span className="text-shop-title font-semibold font-shop-display leading-tight text-shop-text truncate">
            {product.title}
          </span>
          <ShopMono className="text-shop-price text-shop-text whitespace-nowrap shrink-0 font-light">
            {isRange ? 'From ' : ''}
            {formatMoney(minVariantPrice.amount, minVariantPrice.currencyCode)}
            {compareAt &&
            Number(compareAt.amount) > Number(minVariantPrice.amount) ? (
              <span className="ml-1.5 text-shop-ui text-shop-muted line-through">
                {formatMoney(compareAt.amount, compareAt.currencyCode)}
              </span>
            ) : null}
          </ShopMono>
        </div>

        {/* Swatches + Quick View row */}
        <div className="flex items-center justify-between">
          {/* Round color swatches — hover to preview color */}
          <div
            className="flex gap-[10px]"
            onMouseLeave={() => setHoveredColor(null)}
          >
            {swatches.map((s) => (
              <span
                key={s.name}
                title={s.name}
                onMouseEnter={() => setHoveredColor(s.name)}
                className={`w-4 h-4 rounded-full shrink-0 cursor-pointer border transition-[box-shadow,border-color,transform] duration-150 ${
                  hoveredColor === s.name
                    ? 'border-white/70 ring-2 ring-white/30 scale-125'
                    : 'border-white/15 hover:scale-110'
                }`}
                style={
                  s.hex
                    ? { background: s.hex }
                    : {
                        background: 'var(--gradient-commerce-spectrum)',
                      }
                }
              />
            ))}
          </div>

          {/* Quick View — hover only */}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-shop-xs text-shop-text-2 inline-flex items-center gap-1">
            Quick View
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
      </div>
    </div>
  )

  if (onQuickView) {
    return (
      <button
        type="button"
        onClick={() => onQuickView(product.handle)}
        className="text-left block cursor-pointer bg-transparent border-0 p-0"
      >
        {cardBody}
      </button>
    )
  }

  return (
    <Link
      to="/shop/$handle"
      params={{ handle: product.handle }}
      className="block"
    >
      {cardBody}
    </Link>
  )
}
