import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  BuilderEmbeddedSkeleton,
  BuilderRouteReady,
} from '~/components/builder/BuilderLoading'

const LazyEsbuildBuilderSpike = React.lazy(() =>
  import('~/components/charts/EsbuildBuilderSpike.client').then((module) => ({
    default: module.EsbuildBuilderSpike,
  })),
)

export const Route = createFileRoute('/builder_/esbuild')({
  ssr: false,
  pendingComponent: BuilderEmbeddedSkeleton,
  component: EsbuildBuilderSpikeRoute,
})

function EsbuildBuilderSpikeRoute() {
  return (
    <BuilderRouteReady>
      <ClientOnly fallback={<BuilderEmbeddedSkeleton />}>
        <React.Suspense fallback={<BuilderEmbeddedSkeleton />}>
          <LazyEsbuildBuilderSpike />
        </React.Suspense>
      </ClientOnly>
    </BuilderRouteReady>
  )
}
