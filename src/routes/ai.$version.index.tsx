import { createFileRoute } from '@tanstack/react-router'
import AiLanding from '~/components/landing/AiLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/ai/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'ai', AiLanding),
)
