import { createFileRoute } from '@tanstack/react-router'
import StoreLanding from '~/components/landing/StoreLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/store/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'store', StoreLanding),
)
