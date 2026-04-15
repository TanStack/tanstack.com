import { createFileRoute } from '@tanstack/react-router'
import StartLanding from '~/components/landing/StartLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/start/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'start', StartLanding),
)
