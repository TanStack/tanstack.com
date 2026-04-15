import { createFileRoute } from '@tanstack/react-router'
import RouterLanding from '~/components/landing/RouterLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/router/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'router', RouterLanding),
)
