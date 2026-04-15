import { createFileRoute } from '@tanstack/react-router'
import VirtualLanding from '~/components/landing/VirtualLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/virtual/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'virtual', VirtualLanding),
)
