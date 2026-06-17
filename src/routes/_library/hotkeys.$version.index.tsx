import { createFileRoute } from '@tanstack/react-router'
import HotkeysLanding from '~/components/landing/HotkeysLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/hotkeys/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('hotkeys', params.version, location.href)
  },
  loader: ({ params }) =>
    loadLibraryLandingRouteData('hotkeys', params.version),
  head: () => getLibraryLandingHead('hotkeys'),
  headers: () => getLibraryLandingHeaders('hotkeys'),
  staticData: {
    Title: HotkeysNavbarTitle,
  },
  component: HotkeysLandingRoute,
})

function HotkeysNavbarTitle() {
  return <LibraryNavbarTitle libraryId="hotkeys" />
}

function HotkeysLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <HotkeysLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
