import { createFileRoute } from '@tanstack/react-router'
import DbLanding from '~/components/landing/DbLanding'
import {
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/db/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('db', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('db', params.version, queryClient),
  head: () => getLibraryLandingHead('db'),
  headers: () => getLibraryLandingHeaders('db'),
  component: DbLandingRoute,
})

function DbLandingRoute() {
  return <DbLanding />
}
