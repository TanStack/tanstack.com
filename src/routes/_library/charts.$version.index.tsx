import { createFileRoute } from '@tanstack/react-router'
import ChartsLanding from '~/components/landing/ChartsLanding'
import { getChartsCatalogAll } from '~/utils/charts-catalog.functions'
import {
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/charts/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('charts', params.version, location.href)
  },
  loader: async ({ params, context: { queryClient } }) => {
    const [landing, catalog] = await Promise.all([
      loadLibraryLandingRouteData('charts', params.version, queryClient),
      getChartsCatalogAll({ data: { comparison: false } }).catch(() => null),
    ])

    return { ...landing, catalog }
  },
  head: () => getLibraryLandingHead('charts'),
  headers: () => getLibraryLandingHeaders('charts'),
  component: ChartsLandingRoute,
})

function ChartsLandingRoute() {
  const { catalog } = Route.useLoaderData()
  return <ChartsLanding catalog={catalog} />
}
