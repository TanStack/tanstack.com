import { createFileRoute } from '@tanstack/react-router'
import TableLanding from '~/components/landing/TableLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/table/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'table', TableLanding),
)
