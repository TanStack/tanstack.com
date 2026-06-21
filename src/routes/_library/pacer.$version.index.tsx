import { createFileRoute } from '@tanstack/react-router'
import PacerLanding from '~/components/landing/PacerLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/pacer/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('pacer', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('pacer', params.version, queryClient),
  head: () => getLibraryLandingHead('pacer'),
  headers: () => getLibraryLandingHeaders('pacer'),
  staticData: {
    Title: PacerNavbarTitle,
  },
  component: PacerLandingRoute,
})

function PacerNavbarTitle() {
  return <LibraryNavbarTitle libraryId="pacer" />
}

function PacerLandingRoute() {
  return <PacerLanding />
}
