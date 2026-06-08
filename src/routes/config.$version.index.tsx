import { createFileRoute } from '@tanstack/react-router'
import ConfigLanding from '~/components/landing/ConfigLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/config/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('config', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('config', params.version),
  head: () => getLibraryLandingHead('config'),
  headers: () => getLibraryLandingHeaders('config'),
  staticData: {
    Title: ConfigNavbarTitle,
  },
  component: ConfigLandingRoute,
})

function ConfigNavbarTitle() {
  const { version } = Route.useParams()

  return <LibraryNavbarTitle libraryId="config" version={version} />
}

function ConfigLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="config" version={version} config={config}>
      <ConfigLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
