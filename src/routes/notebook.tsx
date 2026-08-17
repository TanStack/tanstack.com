import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  NotebookEmbeddedSkeleton,
  NotebookIndexSkeleton,
  NotebookRouteReady,
} from '~/components/notebook/NotebookLoading'
import { seo } from '~/utils/seo'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazyChartsNotebookPage = React.lazy(() =>
  import('~/components/charts/ChartsNotebookPage.client').then((module) => ({
    default: module.ChartsNotebookPage,
  })),
)

const LazySharedExamplePage = React.lazy(() =>
  import('~/components/examples/SharedExamplePage.client').then((module) => ({
    default: module.SharedExamplePage,
  })),
)

const LazyNotebookIndexPage = React.lazy(() =>
  import('~/components/notebook/NotebookIndexPage.client').then((module) => ({
    default: module.NotebookIndexPage,
  })),
)

export const Route = createFileRoute('/notebook')({
  ssr: false,
  pendingComponent: NotebookIndexSkeleton,
  component: ChartsNotebookRoute,
  headers: () => webContainerHeaders,
  head: () => ({
    meta: seo({
      title: 'Notebooks | TanStack',
      description:
        'Create, run, and share browser sandboxes for TypeScript and TanStack projects.',
    }),
    links: [
      {
        rel: 'alternate',
        type: 'text/plain',
        href: '/notebook/llms.txt',
        title: 'TanStack Notebook authoring guide',
      },
    ],
  }),
})

function ChartsNotebookRoute() {
  return (
    <NotebookRouteReady>
      <ClientOnly fallback={<NotebookIndexSkeleton />}>
        <NotebookClientPage />
      </ClientOnly>
    </NotebookRouteReady>
  )
}

function NotebookClientPage() {
  if (window.location.hash.startsWith('#project=')) {
    return (
      <React.Suspense fallback={<NotebookEmbeddedSkeleton />}>
        <LazySharedExamplePage />
      </React.Suspense>
    )
  }

  if (window.location.hash.startsWith('#code=')) {
    return (
      <React.Suspense fallback={<NotebookEmbeddedSkeleton />}>
        <LazyChartsNotebookPage />
      </React.Suspense>
    )
  }

  return (
    <React.Suspense fallback={<NotebookIndexSkeleton />}>
      <LazyNotebookIndexPage />
    </React.Suspense>
  )
}
