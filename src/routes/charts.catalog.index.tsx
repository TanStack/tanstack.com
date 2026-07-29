import { createFileRoute } from '@tanstack/react-router'
import { ChartsCatalogIndex } from '~/components/charts/ChartsCatalogPages'
import { getChartsCatalogIndex } from '~/utils/charts-catalog.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/charts/catalog/')({
  loader: () => getChartsCatalogIndex(),
  component: ChartsCatalogIndexRoute,
  head: () => ({
    meta: seo({
      title: 'Charts Catalog | TanStack',
      description: 'Executable TanStack Charts examples.',
    }),
  }),
})

function ChartsCatalogIndexRoute() {
  const data = Route.useLoaderData()
  return <ChartsCatalogIndex cases={data.cases} />
}
