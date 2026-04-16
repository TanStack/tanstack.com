import { createFileRoute } from '@tanstack/react-router'
import FormLanding from '~/components/landing/FormLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/form/$version/')(
  createLibraryLandingPage('/form/$version/', 'form', FormLanding),
)
