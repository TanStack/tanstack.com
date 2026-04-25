import { createFileRoute } from '@tanstack/react-router'
import RangerLanding from '~/components/landing/RangerLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/ranger/$version/')(
  createLibraryLandingPage('/ranger/$version/', 'ranger', RangerLanding),
)
