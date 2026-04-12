import { createFileRoute } from '@tanstack/react-router'
import QueryLanding from '~/components/landing/QueryLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/query/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'query', QueryLanding),
)
