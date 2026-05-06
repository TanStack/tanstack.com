import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import * as v from 'valibot'
import { Search as SearchIcon } from 'lucide-react'
import { ProductCard } from '~/components/shop/ProductCard'
import { ShopHero } from '~/components/shop/ShopHero'
import { ShopButton, ShopInput, ShopLabel } from '~/components/shop/ui'
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
  staticData: {
    includeSearchInCanonical: true,
  },
})

function SearchPage() {
  const { query, page } = Route.useLoaderData()
  const navigate = useNavigate({ from: '/shop/search' })
  const [inputValue, setInputValue] = React.useState(query)

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
    <div className="p-6 md:p-11 pb-24 max-w-[1280px] mx-auto flex flex-col gap-8">
      <ShopHero title="Search" />

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
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-shop-muted" />
          <ShopInput
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search products…"
            className="pl-9"
          />
        </div>
        <ShopButton type="submit" variant="primary">
          Search
        </ShopButton>
      </form>

      {!query ? (
        <p className="text-shop-text-2">Type a query above to find products.</p>
      ) : products.length === 0 ? (
        <p className="text-shop-text-2">
          No products match{' '}
          <span className="text-shop-text font-semibold">
            &ldquo;{query}&rdquo;
          </span>
          .
        </p>
      ) : (
        <>
          <ShopLabel>
            {products.length}
            {hasNextPage ? '+' : ''}{' '}
            {products.length === 1 ? 'result' : 'results'} for &ldquo;{query}
            &rdquo;
          </ShopLabel>
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
            <div className="flex justify-center py-6">
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
  )
}
