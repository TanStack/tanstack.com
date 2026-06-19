import { createFileRoute } from '@tanstack/react-router'
import IntentLanding from '~/components/landing/IntentLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/intent/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('intent', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('intent', params.version, queryClient),
  head: () => getLibraryLandingHead('intent'),
  headers: () => getLibraryLandingHeaders('intent'),
  staticData: {
    Title: IntentNavbarTitle,
  },
  component: IntentLandingRoute,
})

function IntentNavbarTitle() {
  return <LibraryNavbarTitle libraryId="intent" />
}

function IntentLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <IntentLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
