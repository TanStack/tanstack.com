import { createFileRoute } from '@tanstack/react-router'
import DbLanding from '~/components/landing/DbLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/db/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('db', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('db', params.version),
  head: () => getLibraryLandingHead('db'),
  headers: () => getLibraryLandingHeaders('db'),
  staticData: {
    Title: DbNavbarTitle,
  },
  component: DbLandingRoute,
})

function DbNavbarTitle() {
  const { version } = Route.useParams()

  return <LibraryNavbarTitle libraryId="db" version={version} />
}

function DbLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="db" version={version} config={config}>
      <DbLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
