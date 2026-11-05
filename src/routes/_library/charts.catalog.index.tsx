import { getChartCatalogBreadcrumbJsonLd } from '~/utils/chart-breadcrumbs'
import { createFileRoute } from '@tanstack/react-router'
import { ChartsCatalog } from '~/components/charts/ChartsCatalogPages'
import { getChartsCatalogAll } from '~/utils/charts-catalog.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/_library/charts/catalog/')({
  loader: () => getChartsCatalogAll(),
  component: ChartsCatalogIndexRoute,
  head: ({ loaderData }) => ({
    scripts: loaderData
      ? [
          {
            type: 'application/ld+json',
            children: JSON.stringify(getChartCatalogBreadcrumbJsonLd()),
          },
        ]
      : [],
    meta: seo({
      title: 'Charts Catalog | TanStack',
      description: 'Executable TanStack Charts examples.',
    }),
  }),
})

function ChartsCatalogIndexRoute() {
  const data = Route.useLoaderData()
  return <ChartsCatalog cases={data.cases} revision={data.revision} />
}
