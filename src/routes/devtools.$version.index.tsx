import { createFileRoute } from '@tanstack/react-router'
import DevtoolsLanding from '~/components/landing/DevtoolsLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/devtools/$version/')(
  createLibraryLandingPage('/devtools/$version/', 'devtools', DevtoolsLanding),
)
