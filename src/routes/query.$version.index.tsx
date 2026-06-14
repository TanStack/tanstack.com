import { createFileRoute } from '@tanstack/react-router'
import QueryLanding from '~/components/landing/QueryLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/query/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('query', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('query', params.version),
  head: () => getLibraryLandingHead('query'),
  headers: () => getLibraryLandingHeaders('query'),
  staticData: {
    Title: QueryNavbarTitle,
  },
  component: QueryLandingRoute,
})

function QueryNavbarTitle() {
  return <LibraryNavbarTitle libraryId="query" />
}

function QueryLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="query" version={version} config={config}>
      <QueryLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
