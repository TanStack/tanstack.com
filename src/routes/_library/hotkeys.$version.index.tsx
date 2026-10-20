import { createFileRoute } from '@tanstack/react-router'
import HotkeysLanding from '~/components/landing/HotkeysLanding'
import {
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
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('hotkeys', params.version, queryClient),
  head: () => getLibraryLandingHead('hotkeys'),
  headers: () => getLibraryLandingHeaders('hotkeys'),
  component: HotkeysLandingRoute,
})

function HotkeysLandingRoute() {
  return <HotkeysLanding />
}
