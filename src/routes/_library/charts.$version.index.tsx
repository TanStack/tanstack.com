import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import ChartsLanding from '~/components/landing/ChartsLanding'
import { getChartsCatalogLanding } from '~/utils/charts-catalog.functions'
import {
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

const getChartsCatalogOrderSeed = createServerFn({ method: 'GET' }).handler(
  () => globalThis.crypto.randomUUID(),
)

export const Route = createFileRoute('/_library/charts/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('charts', params.version, location.href)
  },
  loader: async ({ params, context: { queryClient } }) => {
    const [landingData, catalogOrderSeed, catalog] = await Promise.all([
      loadLibraryLandingRouteData('charts', params.version, queryClient),
      getChartsCatalogOrderSeed({ data: undefined }),
      getChartsCatalogLanding(),
    ])

    return { ...landingData, catalogOrderSeed, catalog }
  },
  head: () => getLibraryLandingHead('charts'),
  headers: () => getLibraryLandingHeaders('charts'),
  component: ChartsLandingRoute,
})

function ChartsLandingRoute() {
  const { catalog, catalogOrderSeed } = Route.useLoaderData()
  return <ChartsLanding catalog={catalog} catalogOrderSeed={catalogOrderSeed} />
}
