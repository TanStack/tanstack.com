import * as React from 'react'
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import * as v from 'valibot'
import { Breadcrumbs } from '~/components/shop/Breadcrumbs'
import { ProductCard } from '~/components/shop/ProductCard'
import { getCollection } from '~/utils/shop.functions'
import {
  COLLECTION_SORT_OPTIONS,
  collectionSortOptionId,
  resolveCollectionSortOption,
  type ProductListItem,
} from '~/utils/shopify-queries'
import { seo } from '~/utils/seo'

const searchSchema = v.object({
  sort: v.optional(
    v.picklist([
      'COLLECTION_DEFAULT',
      'BEST_SELLING',
      'CREATED:rev',
      'PRICE',
      'PRICE:rev',
      'TITLE',
    ]),
  ),
})

type ValidCollectionSortId = NonNullable<
  v.InferOutput<typeof searchSchema>['sort']
>

const PAGE_SIZE = 24

export const Route = createFileRoute('/shop/collections/$handle')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ sort: search.sort }),
  loader: async ({ params, deps }) => {
    const sortOption = resolveCollectionSortOption(deps.sort)
    const collection = await getCollection({
      data: {
        handle: params.handle,
        first: PAGE_SIZE,
        sortKey: sortOption.key,
        reverse: sortOption.reverse,
      },
    })
    if (!collection) throw notFound()
    return {
      collection,
      sortId: collectionSortOptionId(sortOption),
    }
  },
  head: ({ loaderData }) => {
    const c = loaderData?.collection
    if (!c) return { meta: [] }
    return {
      meta: seo({
        title: `${c.seo.title ?? c.title} | TanStack Shop`,
        description: c.seo.description ?? c.description ?? undefined,
      }),
    }
  },
  component: CollectionPage,
})

function CollectionPage() {
  const { collection, sortId } = Route.useLoaderData()
  const navigate = useNavigate({ from: '/shop/collections/$handle' })

  const [accumulated, setAccumulated] = React.useState<Array<ProductListItem>>(
    [],
  )
  const [endCursor, setEndCursor] = React.useState<string | null>(
    collection.products.pageInfo.endCursor,
  )
  const [hasNextPage, setHasNextPage] = React.useState(
    collection.products.pageInfo.hasNextPage,
  )

  React.useEffect(() => {
    setAccumulated([])
    setEndCursor(collection.products.pageInfo.endCursor)
    setHasNextPage(collection.products.pageInfo.hasNextPage)
  }, [collection])

  const loadMore = useMutation({
    mutationFn: async () => {
      if (!endCursor) return null
      const sortOption = resolveCollectionSortOption(sortId)
      return getCollection({
        data: {
          handle: collection.handle,
          first: PAGE_SIZE,
          after: endCursor,
          sortKey: sortOption.key,
          reverse: sortOption.reverse,
        },
      })
    },
    onSuccess: (next) => {
      if (!next) return
      setAccumulated((prev) => [...prev, ...next.products.nodes])
      setEndCursor(next.products.pageInfo.endCursor)
      setHasNextPage(next.products.pageInfo.hasNextPage)
    },
  })

  const products = [...collection.products.nodes, ...accumulated]

  return (
    <div className="flex flex-col max-w-6xl mx-auto gap-8 p-4 md:p-8">
      <Breadcrumbs
        crumbs={[{ label: 'Shop', href: '/shop' }, { label: collection.title }]}
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{collection.title}</h1>
          {collection.description ? (
            <p className="text-sm mt-2 text-gray-600 dark:text-gray-400 max-w-2xl">
              {collection.description}
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Sort by</span>
          <select
            value={sortId}
            onChange={(e) => {
              // Cast is safe: the select only emits ids built from
              // COLLECTION_SORT_OPTIONS, all of which are valid per the
              // valibot search schema. The generated CollectionSortOptionId
              // type is a wider permutation set than the schema accepts.
              const nextId = e.target.value as ValidCollectionSortId
              navigate({
                to: '/shop/collections/$handle',
                params: { handle: collection.handle },
                search: nextId === 'COLLECTION_DEFAULT' ? {} : { sort: nextId },
              })
            }}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
          >
            {COLLECTION_SORT_OPTIONS.map((opt) => (
              <option
                key={collectionSortOptionId(opt)}
                value={collectionSortOptionId(opt)}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {products.length === 0 ? (
        <div className="text-center py-24 text-gray-500">
          No products in this collection yet.
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
  )
}
