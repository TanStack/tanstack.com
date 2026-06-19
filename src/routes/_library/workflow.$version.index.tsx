import { createFileRoute } from '@tanstack/react-router'
import WorkflowLanding from '~/components/landing/WorkflowLanding'
import {
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/workflow/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('workflow', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('workflow', params.version, queryClient),
  head: () => getLibraryLandingHead('workflow'),
  headers: () => getLibraryLandingHeaders('workflow'),
  staticData: {
    Title: WorkflowNavbarTitle,
  },
  component: WorkflowLandingRoute,
})

function WorkflowNavbarTitle() {
  return <LibraryNavbarTitle libraryId="workflow" />
}

function WorkflowLandingRoute() {
  const { landingCodeExampleRsc } = Route.useLoaderData()

  return <WorkflowLanding landingCodeExampleRsc={landingCodeExampleRsc} />
}
