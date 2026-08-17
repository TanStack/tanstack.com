import { createFileRoute } from '@tanstack/react-router'
import FormLanding from '~/components/landing/FormLanding'
import {
  beforeLoadLibraryLanding,
  getLibraryLandingHead,
  getLibraryLandingHeaders,
  libraryLandingStaleTime,
  loadLibraryLandingRouteData,
} from '../-library-landing-route'

export const Route = createFileRoute('/_library/form/$version/')({
  staleTime: libraryLandingStaleTime,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('form', params.version, location.href)
  },
  loader: ({ params, context: { queryClient } }) =>
    loadLibraryLandingRouteData('form', params.version, queryClient),
  head: () => getLibraryLandingHead('form'),
  headers: () => getLibraryLandingHeaders('form'),
  component: FormLandingRoute,
})

function FormLandingRoute() {
  return <FormLanding />
}
