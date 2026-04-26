import * as React from 'react'
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import * as v from 'valibot'
import { ProductCard } from '~/components/shop/ProductCard'
import { ShopHero } from '~/components/shop/ShopHero'
import { ShopButton, ShopCrumbs, ShopSelect } from '~/components/shop/ui'
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
    <div className="p-6 md:p-11 pb-24 max-w-[1280px] mx-auto">
      <ShopCrumbs
        crumbs={[{ label: 'Shop', href: '/shop' }, { label: collection.title }]}
      />

      <div className="flex flex-wrap justify-between items-end gap-4 pb-5.5 border-b border-shop-line mt-6 mb-7">
        <ShopHero title={collection.title} lede={collection.description} />
        <label className="flex items-center gap-2 text-[12px] text-shop-muted">
          <span>Sort</span>
          <ShopSelect
            value={sortId}
            onChange={(e) => {
              const nextId = e.target.value as ValidCollectionSortId
              navigate({
                to: '/shop/collections/$handle',
                params: { handle: collection.handle },
                search: nextId === 'COLLECTION_DEFAULT' ? {} : { sort: nextId },
              })
            }}
          >
            {COLLECTION_SORT_OPTIONS.map((opt) => (
              <option
                key={collectionSortOptionId(opt)}
                value={collectionSortOptionId(opt)}
              >
                {opt.label}
              </option>
            ))}
          </ShopSelect>
        </label>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24 text-shop-muted">
          No products in this collection yet.
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
    </div>
  )
}
