import { createFileRoute } from '@tanstack/react-router'
import RangerLanding from '~/components/landing/RangerLanding'
import {
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/ranger/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('ranger', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('ranger', params.version, queryClient),
  head: ({ match }) =>
    getLibraryLandingHead('ranger', match.status === 'success'),
  headers: () => getLibraryLandingHeaders('ranger'),
  component: RangerLandingRoute,
})

function RangerLandingRoute() {
  return <RangerLanding />
}
