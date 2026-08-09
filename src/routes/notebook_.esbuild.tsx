import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'

const LazyEsbuildNotebookSpike = React.lazy(() =>
  import('~/components/charts/EsbuildNotebookSpike.client').then((module) => ({
    default: module.EsbuildNotebookSpike,
  })),
)

export const Route = createFileRoute('/notebook_/esbuild')({
  ssr: false,
  component: EsbuildNotebookSpikeRoute,
})

function EsbuildNotebookSpikeRoute() {
  return (
    <ClientOnly>
      <React.Suspense fallback={null}>
        <LazyEsbuildNotebookSpike />
      </React.Suspense>
    </ClientOnly>
  )
}
