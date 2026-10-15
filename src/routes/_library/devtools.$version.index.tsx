import { createFileRoute } from '@tanstack/react-router'
import DevtoolsLanding from '~/components/landing/DevtoolsLanding'
import {
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
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('devtools', params.version, queryClient),
  head: () => getLibraryLandingHead('devtools'),
  headers: () => getLibraryLandingHeaders('devtools'),
  component: DevtoolsLandingRoute,
})

function DevtoolsLandingRoute() {
  return <DevtoolsLanding />
}
