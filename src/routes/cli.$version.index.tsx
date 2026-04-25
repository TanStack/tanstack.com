import { createFileRoute } from '@tanstack/react-router'
import CliLanding from '~/components/landing/CliLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/cli/$version/')(
  createLibraryLandingPage('/cli/$version/', 'cli', CliLanding),
)
