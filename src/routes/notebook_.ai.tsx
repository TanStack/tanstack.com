import * as React from 'react'
import { ClientOnly, createFileRoute, notFound } from '@tanstack/react-router'
import {
  NotebookAiSkeleton,
  NotebookRouteReady,
} from '~/components/notebook/NotebookLoading'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazyNotebookAiSpike = React.lazy(() =>
  import('~/components/notebook/NotebookAiSpike.client').then((module) => ({
    default: module.NotebookAiSpike,
  })),
)

export const Route = createFileRoute('/notebook_/ai')({
  ssr: false,
  pendingComponent: NotebookAiSkeleton,
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: NotebookAiSpikeRoute,
  headers: () => webContainerHeaders,
})

function NotebookAiSpikeRoute() {
  return (
    <NotebookRouteReady>
      <ClientOnly fallback={<NotebookAiSkeleton />}>
        <React.Suspense fallback={<NotebookAiSkeleton />}>
          <LazyNotebookAiSpike />
        </React.Suspense>
      </ClientOnly>
    </NotebookRouteReady>
  )
}
