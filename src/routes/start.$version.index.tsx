import { createFileRoute } from '@tanstack/react-router'
import StartLanding from '~/components/landing/StartLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/start/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('start', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('start', params.version),
  head: () => getLibraryLandingHead('start'),
  headers: () => getLibraryLandingHeaders('start'),
  staticData: {
    Title: StartNavbarTitle,
  },
  component: StartLandingRoute,
})

function StartNavbarTitle() {
  return <LibraryNavbarTitle libraryId="start" />
}

function StartLandingRoute() {
  const { version } = Route.useParams()
  const { config } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="start" version={version} config={config}>
      <StartLanding />
    </LibraryLandingLayout>
  )
}
