import { createFileRoute } from '@tanstack/react-router'
import WorkflowLanding from '~/components/landing/WorkflowLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/workflow/$version/')(
  createLibraryLandingPage('/workflow/$version/', 'workflow', WorkflowLanding),
)
