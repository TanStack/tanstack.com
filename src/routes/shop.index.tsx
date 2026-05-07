import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
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
  type ProductListItem,
} from '~/utils/shopify-queries'

const searchSchema = v.object({
  sort: v.optional(
    v.picklist([
      'BEST_SELLING',
      'CREATED_AT:rev',
      'PRICE',
      'PRICE:rev',
      'TITLE',
    ]),
  ),
  type: v.optional(v.string()),
})

type ValidSortId = NonNullable<v.InferOutput<typeof searchSchema>['sort']>

const PAGE_SIZE = 24

export const Route = createFileRoute('/shop/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ sort: search.sort }),
  loader: async ({ deps }) => {
    const sortOption = resolveSortOption(deps.sort)
    const page = await getProducts({
      data: {
        first: PAGE_SIZE,
        sortKey: sortOption.key,
        reverse: sortOption.reverse,
      },
    })
    return { page, sortId: sortOptionId(sortOption) }
  },
  component: ShopIndex,
  staticData: {
    includeSearchInCanonical: true,
  },
})

function ShopIndex() {
  const { page, sortId } = Route.useLoaderData()
  const navigate = useNavigate({ from: '/shop' })
  const search = Route.useSearch()
  const activeType = search.type?.toLowerCase() ?? 'all'

  const [drawerHandle, setDrawerHandle] = React.useState<string | null>(null)

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

  // Client-side filter by productType. Counts update as additional pages load.
  const typeOptions = React.useMemo(() => {
    const counts = new Map<string, { display: string; count: number }>()
    for (const p of allProducts) {
      const t = p.productType?.trim()
      if (!t) continue
      const key = t.toLowerCase()
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { display: t, count: 1 })
    }
    return Array.from(counts.entries())
      .map(([key, { display, count }]) => ({ key, display, count }))
      .sort((a, b) => b.count - a.count)
  }, [allProducts])

  const products =
    activeType === 'all'
      ? allProducts
      : allProducts.filter((p) => p.productType?.toLowerCase() === activeType)

  return (
    <div className="pb-24">
      {/* Hero */}
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

      {/* Sticky filter + sort bar */}
      <div className="sticky top-[var(--navbar-height,56px)] z-10 border-b border-shop-line bg-shop-bg/95 backdrop-blur-sm">
        <div className="max-w-[1280px] mx-auto px-6 md:px-11 flex flex-wrap items-center gap-1.5 py-2">
          <ShopTab
            isActive={activeType === 'all'}
            count={allProducts.length}
            className="px-3 py-1.5 text-shop-sm rounded-lg"
            onClick={() =>
              navigate({
                to: '/shop',
                search: (prev) => ({ ...prev, type: undefined }),
              })
            }
          >
            All
          </ShopTab>
          {typeOptions.map((opt) => (
            <ShopTab
              key={opt.key}
              isActive={activeType === opt.key}
              count={opt.count}
              className="px-3 py-1.5 text-shop-sm rounded-lg"
              onClick={() =>
                navigate({
                  to: '/shop',
                  search: (prev) => ({ ...prev, type: opt.key }),
                })
              }
            >
              {opt.display}
            </ShopTab>
          ))}
          <ShopSelect
            className="ml-auto"
            triggerClassName="py-1.5 pl-3 pr-2.5 text-shop-sm rounded-lg"
            value={sortId}
            onChange={(e) => {
              const nextId = e.target.value as ValidSortId
              navigate({
                to: '/shop',
                search: (prev) => ({
                  ...prev,
                  sort: nextId === 'BEST_SELLING' ? undefined : nextId,
                }),
              })
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

      {/* Product grid */}
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
                  onQuickView={setDrawerHandle}
                />
              ))}
            </section>
            {hasNextPage ? (
              <div className="flex justify-center py-8">
                <ShopButton
                  onClick={() => loadMore.mutate()}
                  disabled={loadMore.isPending}
                >
                  {loadMore.isPending ? 'Loading…' : 'Load more'}
                </ShopButton>
              </div>
            ) : null}
          </>
        )}
      </div>

      <ProductDrawer
        productHandle={drawerHandle}
        allHandles={products.map((p) => p.handle)}
        onClose={() => setDrawerHandle(null)}
        onChange={setDrawerHandle}
      />
    </div>
  )
}
