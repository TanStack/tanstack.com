import { createFileRoute } from '@tanstack/react-router'
import QueryLanding from '~/components/landing/QueryLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/query/$version/')(
  createLibraryLandingPage('/query/$version/', 'query', QueryLanding),
)
