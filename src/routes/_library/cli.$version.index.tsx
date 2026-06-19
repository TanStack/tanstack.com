import { createFileRoute } from '@tanstack/react-router'
import CliLanding from '~/components/landing/CliLanding'
import {
  LibraryNavbarTitle,
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
  staticData: {
    Title: CliNavbarTitle,
  },
  component: CliLandingRoute,
})

function CliNavbarTitle() {
  return <LibraryNavbarTitle libraryId="cli" />
}

function CliLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <CliLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
