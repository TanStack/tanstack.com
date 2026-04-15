import { createFileRoute } from '@tanstack/react-router'
import RangerLanding from '~/components/landing/RangerLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/ranger/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'ranger', RangerLanding),
)
