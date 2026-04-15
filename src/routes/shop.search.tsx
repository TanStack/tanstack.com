import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import * as v from 'valibot'
import { Search as SearchIcon } from 'lucide-react'
import { ProductCard } from '~/components/shop/ProductCard'
import { searchProducts } from '~/utils/shop.functions'
import type { ProductListItem } from '~/utils/shopify-queries'

const searchSchema = v.object({
  q: v.optional(v.string()),
})

const PAGE_SIZE = 24

export const Route = createFileRoute('/shop/search')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => {
    const q = deps.q?.trim()
    if (!q)
      return {
        query: '',
        totalCount: 0,
        page: null as null | Awaited<ReturnType<typeof searchProducts>>,
      }
    const page = await searchProducts({ data: { query: q, first: PAGE_SIZE } })
    return { query: q, totalCount: page.totalCount, page }
  },
  component: SearchPage,
})

function SearchPage() {
  const { query, page } = Route.useLoaderData()
  const navigate = useNavigate({ from: '/shop/search' })
  const [inputValue, setInputValue] = React.useState(query)

  // Sync input when navigating with a new ?q
  React.useEffect(() => {
    setInputValue(query)
  }, [query])

  const [accumulated, setAccumulated] = React.useState<Array<ProductListItem>>(
    [],
  )
  const [endCursor, setEndCursor] = React.useState<string | null>(
    page?.pageInfo.endCursor ?? null,
  )
  const [hasNextPage, setHasNextPage] = React.useState(
    page?.pageInfo.hasNextPage ?? false,
  )

  React.useEffect(() => {
    setAccumulated([])
    setEndCursor(page?.pageInfo.endCursor ?? null)
    setHasNextPage(page?.pageInfo.hasNextPage ?? false)
  }, [page])

  const loadMore = useMutation({
    mutationFn: async () => {
      if (!endCursor || !query) return null
      return searchProducts({
        data: { query, first: PAGE_SIZE, after: endCursor },
      })
    },
    onSuccess: (next) => {
      if (!next) return
      setAccumulated((prev) => [...prev, ...next.products])
      setEndCursor(next.pageInfo.endCursor)
      setHasNextPage(next.pageInfo.hasNextPage)
    },
  })

  const products = [...(page?.products ?? []), ...accumulated]

  return (
    <div className="flex flex-col max-w-6xl mx-auto gap-8 p-4 md:p-8">
      <header>
        <h1 className="text-3xl font-black">Search</h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = inputValue.trim()
          navigate({
            to: '/shop/search',
            search: trimmed ? { q: trimmed } : {},
          })
        }}
        className="flex items-center gap-2 max-w-xl"
      >
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black font-semibold text-sm"
        >
          Search
        </button>
      </form>

      {!query ? (
        <p className="text-gray-600 dark:text-gray-400">
          Type a query above to find products.
        </p>
      ) : products.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">
          No products match{' '}
          <span className="font-semibold">&ldquo;{query}&rdquo;</span>.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {products.length}
            {hasNextPage ? '+' : ''}{' '}
            {products.length === 1 ? 'result' : 'results'} for{' '}
            <span className="font-semibold">&ldquo;{query}&rdquo;</span>
          </p>
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
  )
}
