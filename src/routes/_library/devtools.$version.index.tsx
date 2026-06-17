import { createFileRoute } from '@tanstack/react-router'
import DevtoolsLanding from '~/components/landing/DevtoolsLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/devtools/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('devtools', params.version, location.href)
  },
  loader: ({ params }) =>
    loadLibraryLandingRouteData('devtools', params.version),
  head: () => getLibraryLandingHead('devtools'),
  headers: () => getLibraryLandingHeaders('devtools'),
  staticData: {
    Title: DevtoolsNavbarTitle,
  },
  component: DevtoolsLandingRoute,
})

function DevtoolsNavbarTitle() {
  return <LibraryNavbarTitle libraryId="devtools" />
}

function DevtoolsLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <DevtoolsLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
