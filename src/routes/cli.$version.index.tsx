import { createFileRoute } from '@tanstack/react-router'
import CliLanding from '~/components/landing/CliLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/cli/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('cli', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('cli', params.version),
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
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="cli" version={version} config={config}>
      <CliLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
