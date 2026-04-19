import { createFileRoute } from '@tanstack/react-router'
import StartLanding from '~/components/landing/StartLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/start/$version/')(
  createLibraryLandingPage('/start/$version/', 'start', StartLanding),
)
