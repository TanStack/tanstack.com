import { createFileRoute } from '@tanstack/react-router'
import StartLanding from '~/components/landing/StartLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/start/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('start', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('start', params.version, queryClient),
  head: () => getLibraryLandingHead('start'),
  headers: () => getLibraryLandingHeaders('start'),
  staticData: {
    Title: StartNavbarTitle,
  },
  component: StartLandingRoute,
})

function StartNavbarTitle() {
  return <LibraryNavbarTitle libraryId="start" />
}

function StartLandingRoute() {
  return <StartLanding />
}
