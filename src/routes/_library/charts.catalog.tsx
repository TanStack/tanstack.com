import { Outlet, createFileRoute } from '@tanstack/react-router'
import { docsConfigQueryOptions } from '~/queries/docsConfig'

export const Route = createFileRoute('/_library/charts/catalog')({
  staleTime: 1000 * 60 * 5,
  loader: async ({ context: { queryClient } }) => ({
    config: await queryClient.ensureQueryData(
      docsConfigQueryOptions('charts', 'latest'),
    ),
    version: 'latest',
  }),
  component: ChartsCatalogLayout,
})

function ChartsCatalogLayout() {
  return <Outlet />
}
