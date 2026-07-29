import { createFileRoute, notFound } from '@tanstack/react-router'
import { ChartsCatalogDetail } from '~/components/charts/ChartsCatalogPages'
import { parseChartsCatalogSearch } from '~/utils/charts-catalog'
import { getChartsCatalogCase } from '~/utils/charts-catalog.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/charts/catalog/charts/$caseId')({
  loader: async ({ location, params }) => {
    const data = await getChartsCatalogCase({
      data: {
        caseId: params.caseId,
        ...parseChartsCatalogSearch(location.searchStr),
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
