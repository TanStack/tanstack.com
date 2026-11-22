import * as React from 'react'
import { createClientOnlyFn } from '@tanstack/react-start'
import { ClientOnly, createLazyFileRoute } from '@tanstack/react-router'

const IconographyPage = React.lazy(
  createClientOnlyFn(() =>
    import('~/components/ds/IconographyPage.client').then((module) => ({
      default: module.IconographyPage,
    })),
  ),
)

export const Route = createLazyFileRoute('/ds/iconography')({
  component: () => (
    <ClientOnly>
      <React.Suspense fallback={null}>
        <IconographyPage />
      </React.Suspense>
    </ClientOnly>
  ),
})
