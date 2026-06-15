import { createFileRoute } from '@tanstack/react-router'
import DevtoolsLanding from '~/components/landing/DevtoolsLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/devtools/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('devtools', params.version, location.href)
  },
  loader: ({ params }) =>
    loadLibraryLandingRouteData('devtools', params.version),
  head: () => getLibraryLandingHead('devtools'),
  headers: () => getLibraryLandingHeaders('devtools'),
  staticData: {
    Title: DevtoolsNavbarTitle,
  },
  component: DevtoolsLandingRoute,
})

function DevtoolsNavbarTitle() {
  return <LibraryNavbarTitle libraryId="devtools" />
}

function DevtoolsLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout
      libraryId="devtools"
      version={version}
      config={config}
    >
      <DevtoolsLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
