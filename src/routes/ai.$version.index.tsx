import { createFileRoute } from '@tanstack/react-router'
import AiLanding from '~/components/landing/AiLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/ai/$version/')(
  createLibraryLandingPage('/ai/$version/', 'ai', AiLanding),
)
