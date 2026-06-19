import { createFileRoute } from '@tanstack/react-router'
import VirtualLanding from '~/components/landing/VirtualLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/virtual/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('virtual', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('virtual', params.version, queryClient),
  head: () => getLibraryLandingHead('virtual'),
  headers: () => getLibraryLandingHeaders('virtual'),
  staticData: {
    Title: VirtualNavbarTitle,
  },
  component: VirtualLandingRoute,
})

function VirtualNavbarTitle() {
  return <LibraryNavbarTitle libraryId="virtual" />
}

function VirtualLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <VirtualLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
