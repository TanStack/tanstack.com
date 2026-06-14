import { createFileRoute } from '@tanstack/react-router'
import VirtualLanding from '~/components/landing/VirtualLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/virtual/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('virtual', params.version, location.href)
  },
  loader: ({ params }) =>
    loadLibraryLandingRouteData('virtual', params.version),
  head: () => getLibraryLandingHead('virtual'),
  headers: () => getLibraryLandingHeaders('virtual'),
  staticData: {
    Title: VirtualNavbarTitle,
  },
  component: VirtualLandingRoute,
})

function VirtualNavbarTitle() {
  return <LibraryNavbarTitle libraryId="virtual" />
}

function VirtualLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="virtual" version={version} config={config}>
      <VirtualLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
