import { createFileRoute } from '@tanstack/react-router'
import DbLanding from '~/components/landing/DbLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/db/$version/')({
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
  return <LibraryNavbarTitle libraryId="db" />
}

function DbLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <DbLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
