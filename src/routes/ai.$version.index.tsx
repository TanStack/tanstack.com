import { createFileRoute } from '@tanstack/react-router'
import AiLanding from '~/components/landing/AiLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/ai/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('ai', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('ai', params.version),
  head: () => getLibraryLandingHead('ai'),
  headers: () => getLibraryLandingHeaders('ai'),
  staticData: {
    Title: AiNavbarTitle,
  },
  component: AiLandingRoute,
})

function AiNavbarTitle() {
  return <LibraryNavbarTitle libraryId="ai" />
}

function AiLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="ai" version={version} config={config}>
      <AiLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
