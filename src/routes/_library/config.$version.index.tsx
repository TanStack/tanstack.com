import { createFileRoute } from '@tanstack/react-router'
import ConfigLanding from '~/components/landing/ConfigLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/config/$version/')({
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
  return <LibraryNavbarTitle libraryId="config" />
}

function ConfigLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <ConfigLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
