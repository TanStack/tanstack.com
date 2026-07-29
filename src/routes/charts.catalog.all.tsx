import { createFileRoute } from '@tanstack/react-router'
import { ChartsCatalogAll } from '~/components/charts/ChartsCatalogPages'
import {
  parseChartsCatalogRouteSearch,
  validateChartsCatalogRouteSearch,
} from '~/utils/charts-catalog'
import { getChartsCatalogAll } from '~/utils/charts-catalog.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/charts/catalog/all')({
  validateSearch: validateChartsCatalogRouteSearch,
  loaderDeps: ({ search }) => parseChartsCatalogRouteSearch(search),
  loader: ({ deps }) =>
    getChartsCatalogAll({
      data: deps,
    }),
  component: ChartsCatalogAllRoute,
  head: () => ({
    meta: seo({
      title: 'All Charts | TanStack',
      description: 'Every executable TanStack Charts example.',
    }),
  }),
})

function ChartsCatalogAllRoute() {
  const data = Route.useLoaderData()
  return (
    <ChartsCatalogAll
      artifactRevision={data.artifactRevision}
      cases={data.cases}
    />
  )
}
