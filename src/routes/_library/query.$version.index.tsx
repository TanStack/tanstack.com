import { createFileRoute } from '@tanstack/react-router'
import QueryLanding from '~/components/landing/QueryLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/query/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('query', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('query', params.version, queryClient),
  head: () => getLibraryLandingHead('query'),
  headers: () => getLibraryLandingHeaders('query'),
  staticData: {
    Title: QueryNavbarTitle,
  },
  component: QueryLandingRoute,
})

function QueryNavbarTitle() {
  return <LibraryNavbarTitle libraryId="query" />
}

function QueryLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <QueryLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
