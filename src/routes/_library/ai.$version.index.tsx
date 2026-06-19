import { createFileRoute } from '@tanstack/react-router'
import AiLanding from '~/components/landing/AiLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/ai/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('ai', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('ai', params.version, queryClient),
  head: () => getLibraryLandingHead('ai'),
  headers: () => getLibraryLandingHeaders('ai'),
  staticData: {
    Title: AiNavbarTitle,
  },
  component: AiLandingRoute,
})

function AiNavbarTitle() {
  return <LibraryNavbarTitle libraryId="ai" />
}

function AiLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <AiLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
