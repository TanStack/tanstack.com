import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'

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

export const Route = createFileRoute('/notebook')({
  ssr: false,
  component: ChartsNotebookRoute,
  head: () => ({
    meta: seo({
      title: 'Notebook | TanStack',
      description: 'Write and share client-side TypeScript and JSX modules.',
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
    <ClientOnly>
      <React.Suspense fallback={null}>
        <NotebookClientPage />
      </React.Suspense>
    </ClientOnly>
  )
}

function NotebookClientPage() {
  return window.location.hash.startsWith('#project=') ? (
    <LazySharedExamplePage />
  ) : (
    <LazyChartsNotebookPage />
  )
}
