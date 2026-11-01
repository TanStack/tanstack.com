import * as React from 'react'
import { createClientOnlyFn } from '@tanstack/react-start'
import { ClientOnly } from '@tanstack/react-router'
import { WorkspaceSkeleton } from './WorkspaceSkeleton'

const LazyApp = React.lazy(
  createClientOnlyFn(() =>
    import('./App').then((module) => ({ default: module.App })),
  ),
)

export function AppRoute() {
  return (
    <ClientOnly fallback={<WorkspaceSkeleton />}>
      <React.Suspense fallback={<WorkspaceSkeleton />}>
        <LazyApp />
      </React.Suspense>
    </ClientOnly>
  )
}
