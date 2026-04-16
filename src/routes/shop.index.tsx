import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import * as v from 'valibot'
import { ProductCard } from '~/components/shop/ProductCard'
import { useTheme } from '~/components/ThemeProvider'

const LazyShopHero = React.lazy(() =>
  import('~/components/shop/ShopHero3D').then((m) => ({
    default: m.ShopHero3D,
  })),
)
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

  // Client-side accumulated pages for the "Load More" path. The first page
  // always comes from the loader (SSR), subsequent pages append on click.
  const [accumulated, setAccumulated] = React.useState<Array<ProductListItem>>(
    [],
  )
  const [endCursor, setEndCursor] = React.useState<string | null>(
    page.pageInfo.endCursor,
  )
  const [hasNextPage, setHasNextPage] = React.useState(
    page.pageInfo.hasNextPage,
  )

  // Reset accumulated pages whenever the loader-provided first page changes
  // (e.g. on sort change). The loader's page becomes the new canonical start.
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

  const products = [...page.nodes, ...accumulated]

  return (
    <div className="flex flex-col">
      <div className="w-full aspect-[3/1] max-h-[250px]">
        <React.Suspense fallback={null}>
          <ShopHeroWithTheme />
        </React.Suspense>
      </div>

      <div className="flex flex-col max-w-6xl mx-auto w-full gap-8 p-4 md:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">All Products</h1>
            <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
              {products.length}
              {hasNextPage ? '+' : ''}{' '}
              {products.length === 1 ? 'product' : 'products'}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Sort by</span>
            <select
              value={sortId}
              onChange={(e) => {
                // Cast is safe: the select only emits ids from SORT_OPTIONS
                // which align with the valibot search schema.
                const nextId = e.target.value as ValidSortId
                // Default sort omits the search param entirely for a clean URL
                navigate({
                  to: '/shop',
                  search: nextId === 'BEST_SELLING' ? {} : { sort: nextId },
                })
              }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={sortOptionId(opt)} value={sortOptionId(opt)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        {products.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            No products yet. Check back soon!
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  loading={i < 8 ? 'eager' : 'lazy'}
                />
              ))}
            </section>
            {hasNextPage ? (
              <div className="flex justify-center py-6">
                <button
                  type="button"
                  onClick={() => loadMore.mutate()}
                  disabled={loadMore.isPending}
                  className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadMore.isPending ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function ShopHeroWithTheme() {
  const { resolvedTheme } = useTheme()
  return <LazyShopHero isDark={resolvedTheme === 'dark'} />
}
