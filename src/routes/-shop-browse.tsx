import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import * as v from 'valibot'
import { ProductCard } from '~/components/shop/ProductCard'
import { ProductDrawer } from '~/components/shop/ProductDrawer'
import { ShopHero } from '~/components/shop/ShopHero'
import { ShopButton, ShopSelect, ShopTab } from '~/components/shop/ui'
import { getProducts } from '~/utils/shop.functions'
import {
  SORT_OPTIONS,
  resolveSortOption,
  sortOptionId,
  type ProductDetail,
  type ProductListItem,
  type ProductListPage,
  type SortOptionId,
} from '~/utils/shopify-queries'

const shopSortSearchSchema = v.picklist([
  'BEST_SELLING',
  'CREATED_AT:rev',
  'PRICE',
  'PRICE:rev',
  'TITLE',
])

export const shopBrowseSearchSchema = v.object({
  sort: v.optional(shopSortSearchSchema),
  type: v.optional(v.string()),
  product: v.optional(v.string()),
})

type ShopBrowseSearch = v.InferOutput<typeof shopBrowseSearchSchema>
type ValidSortId = NonNullable<ShopBrowseSearch['sort']>

const PAGE_SIZE = 24

export async function loadShopBrowsePage(sort: ShopBrowseSearch['sort']) {
  const sortOption = resolveSortOption(sort)
  const page = await getProducts({
    data: {
      first: PAGE_SIZE,
      sortKey: sortOption.key,
      reverse: sortOption.reverse,
    },
  })
  return { page, sortId: sortOptionId(sortOption) }
}

type ShopBrowsePageProps = {
  page: ProductListPage
  sortId: SortOptionId
  activeType: string | undefined
  productHandle: string | null
  initialProduct?: ProductDetail | null
  onTypeChange: (type: string | undefined) => void
  onSortChange: (sort: ValidSortId | undefined) => void
  onProductSelect: (handle: string) => void
  onProductClose: () => void
  onProductChange: (handle: string) => void
}

export function ShopBrowsePage({
  page,
  sortId,
  activeType,
  productHandle,
  initialProduct,
  onTypeChange,
  onSortChange,
  onProductSelect,
  onProductClose,
  onProductChange,
}: ShopBrowsePageProps) {
  const normalizedActiveType = activeType?.toLowerCase() ?? 'all'

  const [accumulated, setAccumulated] = React.useState<Array<ProductListItem>>(
    [],
  )
  const [endCursor, setEndCursor] = React.useState<string | null>(
    page.pageInfo.endCursor,
  )
  const [hasNextPage, setHasNextPage] = React.useState(
    page.pageInfo.hasNextPage,
  )

  React.useEffect(() => {
    setAccumulated([])
    setEndCursor(page.pageInfo.endCursor)
    setHasNextPage(page.pageInfo.hasNextPage)
  }, [page])

  const loadMore = useMutation({
    mutationFn: async () => {
      if (!endCursor) return null
      const sortOption = resolveSortOption(sortId)
      return getProducts({
        data: {
          first: PAGE_SIZE,
          after: endCursor,
          sortKey: sortOption.key,
          reverse: sortOption.reverse,
        },
      })
    },
    onSuccess: (next) => {
      if (!next) return
      setAccumulated((prev) => [...prev, ...next.nodes])
      setEndCursor(next.pageInfo.endCursor)
      setHasNextPage(next.pageInfo.hasNextPage)
    },
  })

  const allProducts = React.useMemo(
    () => [...page.nodes, ...accumulated],
    [page.nodes, accumulated],
  )

  const typeOptions = React.useMemo(() => {
    const counts = new Map<string, { display: string; count: number }>()
    for (const product of allProducts) {
      const productType = product.productType?.trim()
      if (!productType) continue
      const key = productType.toLowerCase()
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { display: productType, count: 1 })
    }
    return Array.from(counts.entries())
      .map(([key, { display, count }]) => ({ key, display, count }))
      .sort((a, b) => b.count - a.count)
  }, [allProducts])

  const products =
    normalizedActiveType === 'all'
      ? allProducts
      : allProducts.filter(
          (product) =>
            product.productType?.toLowerCase() === normalizedActiveType,
        )

  return (
    <div className="pb-24">
      <div className="px-6 md:px-11 pt-6 md:pt-11 max-w-[1280px] mx-auto">
        <div className="pb-5.5 border-b border-shop-line-2 mb-7">
          <ShopHero
            title={
              <>
                Built in <em>public</em>,<br />
                worn in <em>production</em>.
              </>
            }
            lede="Official TanStack apparel, accessories, and stickers. Limited runs, ethically produced, shipped worldwide. Rep the libraries that ship your code every day."
          />
        </div>
      </div>

      <div className="sticky top-[var(--navbar-height,56px)] z-10 border-b border-shop-line bg-shop-bg/95 backdrop-blur-sm">
        <div className="max-w-[1280px] mx-auto px-6 md:px-11 flex flex-wrap items-center gap-1.5 py-2">
          <ShopTab
            isActive={normalizedActiveType === 'all'}
            count={allProducts.length}
            className="px-3 py-1.5 text-shop-sm rounded-lg"
            onClick={() => onTypeChange(undefined)}
          >
            All
          </ShopTab>
          {typeOptions.map((opt) => (
            <ShopTab
              key={opt.key}
              isActive={normalizedActiveType === opt.key}
              count={opt.count}
              className="px-3 py-1.5 text-shop-sm rounded-lg"
              onClick={() => onTypeChange(opt.key)}
            >
              {opt.display}
            </ShopTab>
          ))}
          <ShopSelect
            className="ml-auto"
            triggerClassName="py-1.5 pl-3 pr-2.5 text-shop-sm rounded-lg"
            value={sortId}
            onChange={(e) => {
              const nextId = v.parse(shopSortSearchSchema, e.target.value)
              onSortChange(nextId === 'BEST_SELLING' ? undefined : nextId)
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={sortOptionId(opt)} value={sortOptionId(opt)}>
                {opt.label}
              </option>
            ))}
          </ShopSelect>
        </div>
      </div>

      <div className="px-6 md:px-11 max-w-[1280px] mx-auto mt-7">
        {products.length === 0 ? (
          <div className="text-center py-24 text-shop-muted">
            No products yet. Check back soon!
          </div>
        ) : (
          <>
            <section className="grid gap-x-4 gap-y-5.5 grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
              {products.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  loading={i < 8 ? 'eager' : 'lazy'}
                  onQuickView={onProductSelect}
                />
              ))}
            </section>
            {hasNextPage ? (
              <div className="flex justify-center py-8">
                <ShopButton
                  onClick={() => loadMore.mutate()}
                  disabled={loadMore.isPending}
                >
                  {loadMore.isPending ? 'Loading...' : 'Load more'}
                </ShopButton>
              </div>
            ) : null}
          </>
        )}
      </div>

      <ProductDrawer
        productHandle={productHandle}
        initialProduct={initialProduct}
        allHandles={products.map((product) => product.handle)}
        onClose={onProductClose}
        onChange={onProductChange}
      />
    </div>
  )
}
