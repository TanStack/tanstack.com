import { createFileRoute } from '@tanstack/react-router'
import StoreLanding from '~/components/landing/StoreLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/store/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('store', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('store', params.version),
  head: () => getLibraryLandingHead('store'),
  headers: () => getLibraryLandingHeaders('store'),
  staticData: {
    Title: StoreNavbarTitle,
  },
  component: StoreLandingRoute,
})

function StoreNavbarTitle() {
  return <LibraryNavbarTitle libraryId="store" />
}

function StoreLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <StoreLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
