import { getChartBreadcrumbJsonLd } from '~/utils/chart-breadcrumbs'
import { createFileRoute, notFound } from '@tanstack/react-router'
import {
  ChartsCatalogDetail,
  ChartsCatalogDetailPending,
} from '~/components/charts/ChartsCatalogPages'
import { getChartsCatalogCase } from '~/utils/charts-catalog.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/_library/charts/catalog/charts/$caseId')(
  {
    loader: async ({ params }) => {
      const data = await getChartsCatalogCase({
        data: {
          caseId: params.caseId,
        },
      })
      if (!data) throw notFound()
      return data
    },
    pendingComponent: ChartsCatalogDetailPending,
    pendingMs: 250,
    component: ChartsCatalogCaseRoute,
    head: ({ loaderData }) => ({
      scripts: loaderData
        ? [
            {
              type: 'application/ld+json',
              children: JSON.stringify(
                getChartBreadcrumbJsonLd(loaderData.case),
              ).replaceAll('<', '\\u003c'),
            },
          ]
        : [],
      meta: seo({
        title: loaderData
          ? `${loaderData.case.title} | TanStack Charts`
          : 'TanStack Charts',
        description: loaderData?.case.intent ?? 'TanStack Charts example.',
      }),
    }),
  },
)

function ChartsCatalogCaseRoute() {
  const data = Route.useLoaderData()
  return <ChartsCatalogDetail catalogCase={data.case} />
}
