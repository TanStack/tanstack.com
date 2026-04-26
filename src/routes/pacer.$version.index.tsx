import { createFileRoute } from '@tanstack/react-router'
import PacerLanding from '~/components/landing/PacerLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/pacer/$version/')(
  createLibraryLandingPage('/pacer/$version/', 'pacer', PacerLanding),
)
