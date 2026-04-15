import { createFileRoute } from '@tanstack/react-router'
import ConfigLanding from '~/components/landing/ConfigLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/config/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'config', ConfigLanding),
)
