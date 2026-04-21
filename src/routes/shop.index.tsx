import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import * as v from 'valibot'
import { ProductCard } from '~/components/shop/ProductCard'
import { ShopHero } from '~/components/shop/ShopHero'
import { ShopDropCard } from '~/components/shop/ShopDropCard'
import { ShopStrip } from '~/components/shop/ShopStrip'
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
})

function ShopIndex() {
  const { page, sortId } = Route.useLoaderData()
  const navigate = useNavigate({ from: '/shop' })
  const search = Route.useSearch()
  const activeType = search.type?.toLowerCase() ?? 'all'

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
    <div className="p-6 md:p-11 pb-24 max-w-[1280px] mx-auto">
      <div className="flex flex-wrap justify-between items-start gap-10 pb-5.5 border-b border-shop-line mb-7">
        <ShopHero
          title={
            <>
              Built in <em>public</em>,<br />
              worn in <em>production</em>.
            </>
          }
          lede="Official TanStack apparel, accessories, and stickers. Limited runs, ethically produced, shipped worldwide. Rep the libraries that ship your code every day."
        />
        <ShopDropCard
          status="Shop now — free US shipping over $75"
          headline="Ship code, wear the merch."
          rows={[
            { label: 'Worldwide', value: '7–10 days' },
            { label: 'Returns', value: '30 days' },
            { label: 'Free ship over', value: '$75' },
          ]}
          cta={{ label: 'Shop all products', href: '/shop' }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pb-4.5">
        <ShopTab
          isActive={activeType === 'all'}
          count={allProducts.length}
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
        <label className="ml-auto flex items-center gap-2 text-[12px] text-shop-muted">
          <span>Sort</span>
          <ShopSelect
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
        </label>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24 text-shop-muted">
          No products yet. Check back soon!
        </div>
      ) : (
        <>
          <section className="grid gap-x-4 gap-y-5.5 grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                loading={i < 8 ? 'eager' : 'lazy'}
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

      <ShopStrip
        items={[
          'Worldwide shipping',
          '30-day returns',
          'Carbon-neutral packing',
          'Official TanStack',
          'Proceeds fund open-source',
        ]}
      />
    </div>
  )
}
