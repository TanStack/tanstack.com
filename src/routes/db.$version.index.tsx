import { createFileRoute } from '@tanstack/react-router'
import DbLanding from '~/components/landing/DbLanding'
import { createLibraryLandingPage } from './-library-landing'

const routePath = '/db/$version/'

export const Route = createFileRoute(routePath)(
  createLibraryLandingPage(routePath, 'db', DbLanding),
)
