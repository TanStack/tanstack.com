import { createFileRoute } from '@tanstack/react-router'
import CliLanding from '~/components/landing/CliLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/cli/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'cli', CliLanding),
)
