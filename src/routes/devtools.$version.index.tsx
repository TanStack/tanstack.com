import { createFileRoute } from '@tanstack/react-router'
import DevtoolsLanding from '~/components/landing/DevtoolsLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/devtools/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'devtools', DevtoolsLanding),
)
