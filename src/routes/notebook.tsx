import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'

const LazyChartsNotebookPage = React.lazy(() =>
  import('~/components/charts/ChartsNotebookPage.client').then((module) => ({
    default: module.ChartsNotebookPage,
  })),
)

export const Route = createFileRoute('/notebook')({
  ssr: false,
  component: ChartsNotebookRoute,
  head: () => ({
    meta: seo({
      title: 'Notebook | TanStack',
      description: 'Write and share client-side JavaScript modules.',
    }),
  }),
})

function ChartsNotebookRoute() {
  return (
    <ClientOnly>
      <React.Suspense fallback={null}>
        <LazyChartsNotebookPage />
      </React.Suspense>
    </ClientOnly>
  )
}
