import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import ChartsLanding from '~/components/landing/ChartsLanding'
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
    const [landingData, catalogOrderSeed] = await Promise.all([
      loadLibraryLandingRouteData('charts', params.version, queryClient),
      getChartsCatalogOrderSeed({ data: undefined }),
    ])

    return { ...landingData, catalogOrderSeed }
  },
  head: () => getLibraryLandingHead('charts'),
  headers: () => getLibraryLandingHeaders('charts'),
  component: ChartsLandingRoute,
})

function ChartsLandingRoute() {
  const { catalogOrderSeed } = Route.useLoaderData()
  return <ChartsLanding catalogOrderSeed={catalogOrderSeed} />
}
