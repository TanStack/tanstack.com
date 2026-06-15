import { createFileRoute } from '@tanstack/react-router'
import RangerLanding from '~/components/landing/RangerLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/ranger/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('ranger', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('ranger', params.version),
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
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="ranger" version={version} config={config}>
      <RangerLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
