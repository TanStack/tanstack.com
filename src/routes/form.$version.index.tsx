import { createFileRoute } from '@tanstack/react-router'
import FormLanding from '~/components/landing/FormLanding'
import {
  LibraryLandingLayout,
  LibraryNavbarTitle,
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from './-library-landing-route'

export const Route = createFileRoute('/form/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('form', params.version, location.href)
  },
  loader: ({ params }) => loadLibraryLandingRouteData('form', params.version),
  head: () => getLibraryLandingHead('form'),
  headers: () => getLibraryLandingHeaders('form'),
  staticData: {
    Title: FormNavbarTitle,
  },
  component: FormLandingRoute,
})

function FormNavbarTitle() {
  return <LibraryNavbarTitle libraryId="form" />
}

function FormLandingRoute() {
  const { version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()

  return (
    <LibraryLandingLayout libraryId="form" version={version} config={config}>
      <FormLanding landingCodeExampleRsc={landingCodeExampleRsc} />
    </LibraryLandingLayout>
  )
}
