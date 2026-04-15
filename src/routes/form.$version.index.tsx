import { createFileRoute } from '@tanstack/react-router'
import FormLanding from '~/components/landing/FormLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/form/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'form', FormLanding),
)
