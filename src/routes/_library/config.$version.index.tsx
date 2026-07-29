import { createFileRoute } from '@tanstack/react-router'
import ConfigLanding from '~/components/landing/ConfigLanding'
import {
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/config/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('config', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('config', params.version, queryClient),
  head: () => getLibraryLandingHead('config'),
  headers: () => getLibraryLandingHeaders('config'),
  component: ConfigLandingRoute,
})

function ConfigLandingRoute() {
  return <ConfigLanding />
}
