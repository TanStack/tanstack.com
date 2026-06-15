import { createFileRoute } from '@tanstack/react-router'
import PacerLanding from '~/components/landing/PacerLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/pacer/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('pacer', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('pacer', params.version),
  head: () => getLibraryLandingHead('pacer'),
  headers: () => getLibraryLandingHeaders('pacer'),
  staticData: {
    Title: PacerNavbarTitle,
  },
  component: PacerLandingRoute,
})

function PacerNavbarTitle() {
  return <LibraryNavbarTitle libraryId="pacer" />
}

function PacerLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="pacer" version={version} config={config}>
      <PacerLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
