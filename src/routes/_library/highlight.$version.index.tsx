import { createFileRoute } from '@tanstack/react-router'
import HighlightLanding from '~/components/landing/HighlightLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/highlight/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('highlight', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('highlight', params.version, queryClient),
  head: () => getLibraryLandingHead('highlight'),
  headers: () => getLibraryLandingHeaders('highlight'),
  staticData: {
    Title: HighlightNavbarTitle,
  },
  component: HighlightLandingRoute,
})

function HighlightNavbarTitle() {
  return <LibraryNavbarTitle libraryId="highlight" />
}

function HighlightLandingRoute() {
  return <HighlightLanding />
}
