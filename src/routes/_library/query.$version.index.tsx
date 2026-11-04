import { createFileRoute } from '@tanstack/react-router'
import QueryLanding from '~/components/landing/QueryLanding'
import {
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/query/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('query', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('query', params.version, queryClient),
  head: ({ match }) =>
    getLibraryLandingHead('query', match.status === 'success'),
  headers: () => getLibraryLandingHeaders('query'),
  component: QueryLandingRoute,
})

function QueryLandingRoute() {
  return <QueryLanding />
}
