import { createFileRoute } from '@tanstack/react-router'
import TableLanding from '~/components/landing/TableLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/table/$version/')(
  createLibraryLandingPage('/table/$version/', 'table', TableLanding),
)
