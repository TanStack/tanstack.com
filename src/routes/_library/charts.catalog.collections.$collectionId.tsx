import { getChartCollectionBreadcrumbJsonLd } from '~/utils/chart-breadcrumbs'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { ChartsCatalog } from '~/components/charts/ChartsCatalogPages'
import { isChartsCatalogCaseId } from '~/utils/charts-catalog'
import { getChartsCatalogCollection } from '~/utils/charts-catalog.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute(
  '/_library/charts/catalog/collections/$collectionId',
)({
  loader: async ({ params }) => {
    if (!isChartsCatalogCaseId(params.collectionId)) throw notFound()
    const data = await getChartsCatalogCollection({
      data: { collectionId: params.collectionId },
    })
    if (!data) throw notFound()
    return data
  },
  component: ChartsCatalogCollectionRoute,
  head: ({ loaderData }) => ({
    scripts: loaderData
      ? [
          {
            type: 'application/ld+json',
            children: JSON.stringify(
              getChartCollectionBreadcrumbJsonLd(loaderData.collection),
            ).replaceAll('<', '\\u003c'),
          },
        ]
      : [],
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
