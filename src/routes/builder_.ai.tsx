import * as React from 'react'
import { ClientOnly, createFileRoute, notFound } from '@tanstack/react-router'
import {
  BuilderAiSkeleton,
  BuilderRouteReady,
} from '~/components/builder/BuilderLoading'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazyBuilderAiSpike = React.lazy(() =>
  import('~/components/builder/BuilderAiSpike.client').then((module) => ({
    default: module.BuilderAiSpike,
  })),
)

export const Route = createFileRoute('/builder_/ai')({
  ssr: false,
  pendingComponent: BuilderAiSkeleton,
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: BuilderAiSpikeRoute,
  headers: () => webContainerHeaders,
})

function BuilderAiSpikeRoute() {
  return (
    <BuilderRouteReady>
      <ClientOnly fallback={<BuilderAiSkeleton />}>
        <React.Suspense fallback={<BuilderAiSkeleton />}>
          <LazyBuilderAiSpike />
        </React.Suspense>
      </ClientOnly>
    </BuilderRouteReady>
  )
}
