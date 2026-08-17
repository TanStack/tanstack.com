import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import {
  NotebookEditorSkeleton,
  NotebookRouteReady,
} from '~/components/notebook/NotebookLoading'
import { seo } from '~/utils/seo'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazyNotebookDraftPage = React.lazy(() =>
  import('~/components/notebook/NotebookDraftPage.client').then((module) => ({
    default: module.NotebookDraftPage,
  })),
)

export const Route = createFileRoute('/notebook_/new')({
  ssr: false,
  pendingComponent: NotebookEditorSkeleton,
  validateSearch: v.object({
    template: v.optional(v.string()),
  }),
  component: NotebookDraftRoute,
  headers: () => webContainerHeaders,
  head: () => ({
    meta: seo({
      title: 'New notebook | TanStack',
      description: 'Create and run a browser-local TanStack notebook.',
      noindex: true,
    }),
  }),
})

function NotebookDraftRoute() {
  const { template } = Route.useSearch()

  return (
    <NotebookRouteReady>
      <ClientOnly fallback={<NotebookEditorSkeleton />}>
        <React.Suspense fallback={<NotebookEditorSkeleton />}>
          <LazyNotebookDraftPage template={template} />
        </React.Suspense>
      </ClientOnly>
    </NotebookRouteReady>
  )
}
