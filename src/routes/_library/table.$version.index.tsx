import { createFileRoute } from '@tanstack/react-router'
import TableLanding from '~/components/landing/TableLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/table/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('table', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('table', params.version, queryClient),
  head: () => getLibraryLandingHead('table'),
  headers: () => getLibraryLandingHeaders('table'),
  staticData: {
    Title: TableNavbarTitle,
  },
  component: TableLandingRoute,
})

function TableNavbarTitle() {
  return <LibraryNavbarTitle libraryId="table" />
}

function TableLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <TableLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
