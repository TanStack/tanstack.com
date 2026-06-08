import { createFileRoute } from '@tanstack/react-router'
import TableLanding from '~/components/landing/TableLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/table/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('table', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('table', params.version),
  head: () => getLibraryLandingHead('table'),
  headers: () => getLibraryLandingHeaders('table'),
  staticData: {
    Title: TableNavbarTitle,
  },
  component: TableLandingRoute,
})

function TableNavbarTitle() {
  const { version } = Route.useParams()

  return <LibraryNavbarTitle libraryId="table" version={version} />
}

function TableLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="table" version={version} config={config}>
      <TableLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
