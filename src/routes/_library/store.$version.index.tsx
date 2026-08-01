import { createFileRoute } from '@tanstack/react-router'
import StoreLanding from '~/components/landing/StoreLanding'
import {
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
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('store', params.version, queryClient),
  head: () => getLibraryLandingHead('store'),
  headers: () => getLibraryLandingHeaders('store'),
  component: StoreLandingRoute,
})

function StoreLandingRoute() {
  return <StoreLanding />
}
