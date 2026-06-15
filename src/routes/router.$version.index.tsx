import { createFileRoute } from '@tanstack/react-router'
import RouterLanding from '~/components/landing/RouterLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/router/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('router', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('router', params.version),
  head: () => getLibraryLandingHead('router'),
  headers: () => getLibraryLandingHeaders('router'),
  staticData: {
    Title: RouterNavbarTitle,
  },
  component: RouterLandingRoute,
})

function RouterNavbarTitle() {
  return <LibraryNavbarTitle libraryId="router" />
}

function RouterLandingRoute() {
  const { version } = Route.useParams()
  const { config } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="router" version={version} config={config}>
      <RouterLanding />
    </LibraryLandingLayout>
  )
}
