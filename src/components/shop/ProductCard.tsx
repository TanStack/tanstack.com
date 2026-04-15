import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { ProductImage } from './ProductImage'
import { formatMoney } from '~/utils/shopify-format'
import type { ProductListItem } from '~/utils/shopify-queries'

type ProductCardProps = {
  product: ProductListItem
  sizes?: string
  loading?: 'eager' | 'lazy'
}

/**
 * Grid tile for a product. Handles compare-at-price strike-through and
 * the "from $X" treatment when a product has variants at different prices.
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

  return (
    <Link
      to="/shop/products/$handle"
      params={{ handle: product.handle }}
      className="group flex flex-col gap-3"
    >
      <div className="aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-900">
        <ProductImage
          image={product.featuredImage}
          alt={product.title}
          width={600}
          sizes={sizes}
          loading={loading}
          className="transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold line-clamp-2">{product.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-baseline gap-2">
          <span>
            {isRange ? 'From ' : ''}
            {formatMoney(minVariantPrice.amount, minVariantPrice.currencyCode)}
          </span>
          {isDiscounted ? (
            <span
              className={twMerge(
                'text-xs line-through text-gray-400 dark:text-gray-500',
              )}
            >
              {formatMoney(compareAt.amount, compareAt.currencyCode)}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  )
}
