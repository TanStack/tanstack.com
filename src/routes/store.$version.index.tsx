import { createFileRoute } from '@tanstack/react-router'
import StoreLanding from '~/components/landing/StoreLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/store/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('store', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('store', params.version),
  head: () => getLibraryLandingHead('store'),
  headers: () => getLibraryLandingHeaders('store'),
  staticData: {
    Title: StoreNavbarTitle,
  },
  component: StoreLandingRoute,
})

function StoreNavbarTitle() {
  const { version } = Route.useParams()

  return <LibraryNavbarTitle libraryId="store" version={version} />
}

function StoreLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="store" version={version} config={config}>
      <StoreLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
