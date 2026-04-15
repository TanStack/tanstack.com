import { createFileRoute } from '@tanstack/react-router'
import PacerLanding from '~/components/landing/PacerLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/pacer/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'pacer', PacerLanding),
)
