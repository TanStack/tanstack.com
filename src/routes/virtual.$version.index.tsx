import { createFileRoute } from '@tanstack/react-router'
import VirtualLanding from '~/components/landing/VirtualLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/virtual/$version/')(
  createLibraryLandingPage('/virtual/$version/', 'virtual', VirtualLanding),
)
