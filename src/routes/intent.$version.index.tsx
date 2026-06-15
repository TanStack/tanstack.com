import { createFileRoute } from '@tanstack/react-router'
import IntentLanding from '~/components/landing/IntentLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/intent/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('intent', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('intent', params.version),
  head: () => getLibraryLandingHead('intent'),
  headers: () => getLibraryLandingHeaders('intent'),
  staticData: {
    Title: IntentNavbarTitle,
  },
  component: IntentLandingRoute,
})

function IntentNavbarTitle() {
  return <LibraryNavbarTitle libraryId="intent" />
}

function IntentLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="intent" version={version} config={config}>
      <IntentLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
