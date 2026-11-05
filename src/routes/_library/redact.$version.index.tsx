import { createFileRoute } from '@tanstack/react-router'
import RedactLanding from '~/components/landing/RedactLanding'
import {
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/redact/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('redact', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('redact', params.version, queryClient),
  head: ({ match }) =>
    getLibraryLandingHead('redact', match.status === 'success'),
  headers: () => getLibraryLandingHeaders('redact'),
  component: RedactLandingRoute,
})

function RedactLandingRoute() {
  return <RedactLanding />
}
