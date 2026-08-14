import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazySharedExamplePage = React.lazy(() =>
  import('~/components/examples/SharedExamplePage.client').then((module) => ({
    default: module.SharedExamplePage,
  })),
)

export const Route = createFileRoute('/notebook_/p/$hash')({
  ssr: false,
  component: SharedNotebookRoute,
  headers: () => webContainerHeaders,
})

function SharedNotebookRoute() {
  const { hash } = Route.useParams()

  return (
    <ClientOnly>
      <React.Suspense fallback={null}>
        <LazySharedExamplePage hash={hash} />
      </React.Suspense>
    </ClientOnly>
  )
}
