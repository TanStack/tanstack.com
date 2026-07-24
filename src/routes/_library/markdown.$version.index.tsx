import { createFileRoute } from '@tanstack/react-router'
import MarkdownLanding from '~/components/landing/MarkdownLanding'
import {
  LibraryNavbarTitle,
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
  head: () => getLibraryLandingHead('markdown'),
  headers: () => getLibraryLandingHeaders('markdown'),
  staticData: {
    Title: MarkdownNavbarTitle,
  },
  component: MarkdownLandingRoute,
})

function MarkdownNavbarTitle() {
  return <LibraryNavbarTitle libraryId="markdown" />
}

function MarkdownLandingRoute() {
  return <MarkdownLanding />
}
