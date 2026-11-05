import { createFileRoute } from '@tanstack/react-router'
import VirtualLanding from '~/components/landing/VirtualLanding'
import {
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
  head: ({ match }) =>
    getLibraryLandingHead('virtual', match.status === 'success'),
  headers: () => getLibraryLandingHeaders('virtual'),
  component: VirtualLandingRoute,
})

function VirtualLandingRoute() {
  return <VirtualLanding />
}
