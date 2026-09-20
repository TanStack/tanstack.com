import { createFileRoute, notFound } from '@tanstack/react-router'
import { ChartsCatalog } from '~/components/charts/ChartsCatalogPages'
import { getChartsCatalogCollection } from '~/utils/charts-catalog.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute(
  '/_library/charts/catalog/collections/$collectionId',
)({
  loader: async ({ params }) => {
    const data = await getChartsCatalogCollection({
      data: { collectionId: params.collectionId },
    })
    if (!data) throw notFound()
    return data
  },
  component: ChartsCatalogCollectionRoute,
  head: ({ loaderData }) => ({
    meta: seo({
      title: loaderData
        ? `${loaderData.collection.title} | TanStack Charts`
        : 'TanStack Charts',
      description:
        loaderData?.collection.description ?? 'TanStack Charts examples.',
    }),
  }),
})

function ChartsCatalogCollectionRoute() {
  const data = Route.useLoaderData()
  return (
    <ChartsCatalog
      cases={data.cases}
      collection={data.collection}
      revision={data.revision}
    />
  )
}
