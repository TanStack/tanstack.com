import { createFileRoute } from '@tanstack/react-router'
import RouterLanding from '~/components/landing/RouterLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/router/$version/')(
  createLibraryLandingPage('/router/$version/', 'router', RouterLanding),
)
