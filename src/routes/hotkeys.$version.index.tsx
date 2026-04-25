import { createFileRoute } from '@tanstack/react-router'
import HotkeysLanding from '~/components/landing/HotkeysLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/hotkeys/$version/')(
  createLibraryLandingPage('/hotkeys/$version/', 'hotkeys', HotkeysLanding),
)
