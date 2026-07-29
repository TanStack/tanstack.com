import { createFileRoute, notFound } from '@tanstack/react-router'
import { ChartsCatalogDetail } from '~/components/charts/ChartsCatalogPages'
import {
  parseChartsCatalogRouteSearch,
  validateChartsCatalogRouteSearch,
} from '~/utils/charts-catalog'
import { getChartsCatalogCase } from '~/utils/charts-catalog.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/charts/catalog/charts/$caseId')({
  validateSearch: validateChartsCatalogRouteSearch,
  loaderDeps: ({ search }) => parseChartsCatalogRouteSearch(search),
  loader: async ({ deps, params }) => {
    const data = await getChartsCatalogCase({
      data: {
        caseId: params.caseId,
        ...deps,
      },
    })
    if (!data) throw notFound()
    return data
  },
  component: ChartsCatalogCaseRoute,
  head: ({ loaderData }) => ({
    meta: seo({
      title: loaderData
        ? `${loaderData.case.title} | TanStack Charts`
        : 'TanStack Charts',
      description: loaderData?.case.intent ?? 'TanStack Charts example.',
    }),
  }),
})

function ChartsCatalogCaseRoute() {
  const data = Route.useLoaderData()
  return (
    <ChartsCatalogDetail
      artifactRevision={data.artifactRevision}
      catalogCase={data.case}
    />
  )
}
