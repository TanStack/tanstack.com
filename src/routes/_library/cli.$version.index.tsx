import { createFileRoute } from '@tanstack/react-router'
import CliLanding from '~/components/landing/CliLanding'
import {
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/cli/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('cli', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('cli', params.version, queryClient),
  head: () => getLibraryLandingHead('cli'),
  headers: () => getLibraryLandingHeaders('cli'),
  component: CliLandingRoute,
})

function CliLandingRoute() {
  return <CliLanding />
}
