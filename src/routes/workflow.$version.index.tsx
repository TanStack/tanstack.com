import { createFileRoute } from '@tanstack/react-router'
import WorkflowLanding from '~/components/landing/WorkflowLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/workflow/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('workflow', params.version, location.href)
  },
  loader: ({ params }) =>
    loadLibraryLandingRouteData('workflow', params.version),
  head: () => getLibraryLandingHead('workflow'),
  headers: () => getLibraryLandingHeaders('workflow'),
  staticData: {
    Title: WorkflowNavbarTitle,
  },
  component: WorkflowLandingRoute,
})

function WorkflowNavbarTitle() {
  const { version } = Route.useParams()

  return <LibraryNavbarTitle libraryId="workflow" version={version} />
}

function WorkflowLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout
      libraryId="workflow"
      version={version}
      config={config}
    >
      <WorkflowLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
