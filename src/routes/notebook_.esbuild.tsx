import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  NotebookEmbeddedSkeleton,
  NotebookRouteReady,
} from '~/components/notebook/NotebookLoading'

const LazyEsbuildNotebookSpike = React.lazy(() =>
  import('~/components/charts/EsbuildNotebookSpike.client').then((module) => ({
    default: module.EsbuildNotebookSpike,
  })),
)

export const Route = createFileRoute('/notebook_/esbuild')({
  ssr: false,
  pendingComponent: NotebookEmbeddedSkeleton,
  component: EsbuildNotebookSpikeRoute,
})

function EsbuildNotebookSpikeRoute() {
  return (
    <NotebookRouteReady>
      <ClientOnly fallback={<NotebookEmbeddedSkeleton />}>
        <React.Suspense fallback={<NotebookEmbeddedSkeleton />}>
          <LazyEsbuildNotebookSpike />
        </React.Suspense>
      </ClientOnly>
    </NotebookRouteReady>
  )
}
