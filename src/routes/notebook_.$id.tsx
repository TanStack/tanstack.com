import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  NotebookEditorSkeleton,
  NotebookRouteReady,
} from '~/components/notebook/NotebookLoading'
import { seo } from '~/utils/seo'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazyNotebookPage = React.lazy(() =>
  import('~/components/notebook/NotebookPage.client').then((module) => ({
    default: module.NotebookPage,
  })),
)

export const Route = createFileRoute('/notebook_/$id')({
  ssr: false,
  pendingComponent: NotebookEditorSkeleton,
  component: NotebookRoute,
  headers: () => webContainerHeaders,
  head: () => ({
    meta: seo({
      title: 'Notebook | TanStack',
      description: 'Run and inspect a public TanStack notebook.',
      noindex: true,
    }),
  }),
})

function NotebookRoute() {
  const { id } = Route.useParams()

  return (
    <NotebookRouteReady>
      <ClientOnly fallback={<NotebookEditorSkeleton />}>
        <React.Suspense fallback={<NotebookEditorSkeleton />}>
          <LazyNotebookPage key={id} id={id} />
        </React.Suspense>
      </ClientOnly>
    </NotebookRouteReady>
  )
}
