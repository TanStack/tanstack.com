import { createFileRoute } from '@tanstack/react-router'
import MarkdownLanding from '~/components/landing/MarkdownLanding'
import {
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/markdown/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('markdown', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('markdown', params.version, queryClient),
  head: ({ match }) =>
    getLibraryLandingHead('markdown', match.status === 'success'),
  headers: () => getLibraryLandingHeaders('markdown'),
  component: MarkdownLandingRoute,
})

function MarkdownLandingRoute() {
  return <MarkdownLanding />
}
