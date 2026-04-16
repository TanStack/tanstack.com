import { createFileRoute } from '@tanstack/react-router'
import DbLanding from '~/components/landing/DbLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/db/$version/')(
  createLibraryLandingPage('/db/$version/', 'db', DbLanding),
)
