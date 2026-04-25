import { createFileRoute } from '@tanstack/react-router'
import ConfigLanding from '~/components/landing/ConfigLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/config/$version/')(
  createLibraryLandingPage('/config/$version/', 'config', ConfigLanding),
)
