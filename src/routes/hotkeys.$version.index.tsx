import { createFileRoute } from '@tanstack/react-router'
import HotkeysLanding from '~/components/landing/HotkeysLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/hotkeys/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'hotkeys', HotkeysLanding),
)
