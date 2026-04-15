import { createFileRoute } from '@tanstack/react-router'
import IntentLanding from '~/components/landing/IntentLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/intent/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'intent', IntentLanding),
)
