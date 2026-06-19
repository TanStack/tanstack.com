import { createFileRoute } from '@tanstack/react-router'
import RangerLanding from '~/components/landing/RangerLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/ranger/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('ranger', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('ranger', params.version, queryClient),
  head: () => getLibraryLandingHead('ranger'),
  headers: () => getLibraryLandingHeaders('ranger'),
  staticData: {
    Title: RangerNavbarTitle,
  },
  component: RangerLandingRoute,
})

function RangerNavbarTitle() {
  return <LibraryNavbarTitle libraryId="ranger" />
}

function RangerLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <RangerLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
