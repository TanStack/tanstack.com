import { createFileRoute } from '@tanstack/react-router'
import StoreLanding from '~/components/landing/StoreLanding'
import { createLibraryLandingPage } from './-library-landing'

export const Route = createFileRoute('/store/$version/')(
  createLibraryLandingPage('/store/$version/', 'store', StoreLanding),
)
