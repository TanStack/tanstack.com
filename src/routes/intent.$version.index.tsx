import { createFileRoute } from '@tanstack/react-router'
import IntentLanding from '~/components/landing/IntentLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/intent/$version/')(
  createLibraryLandingPage('/intent/$version/', 'intent', IntentLanding),
)
