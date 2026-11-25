import { Outlet, createFileRoute } from '@tanstack/react-router'
import { docsConfigQueries } from '~/queries/docsConfig'

export const Route = createFileRoute('/_library/charts/catalog')({
  staleTime: 1000 * 60 * 5,
  loader: async ({ context: { queryClient } }) => ({
    config: await queryClient.ensureQueryData(
      docsConfigQueries.detail('charts', 'latest'),
    ),
    version: 'latest',
  }),
  component: ChartsCatalogLayout,
  staticData: {
    docsTab: { id: 'examples', fullBleed: true },
  },
})

function ChartsCatalogLayout() {
  return <Outlet />
}
