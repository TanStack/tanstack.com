import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  BuilderEmbeddedSkeleton,
  BuilderRouteReady,
} from '~/chat/components/projects/Loading'
import { seo } from '~/utils/seo'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazyChartsBuilderPage = React.lazy(() =>
  import('~/components/charts/ChartsBuilderPage.client').then((module) => ({
    default: module.ChartsBuilderPage,
  })),
)

export const Route = createFileRoute('/chat/charts')({
  ssr: false,
  pendingComponent: BuilderEmbeddedSkeleton,
  component: ChartsBuilderRoute,
  headers: () => webContainerHeaders,
  head: () => ({
    meta: seo({
      title: 'Chart playground | TanStack',
      description: 'Create, run, and share TanStack charts.',
      noindex: true,
    }),
  }),
})

function ChartsBuilderRoute() {
  return (
    <BuilderRouteReady>
      <ClientOnly fallback={<BuilderEmbeddedSkeleton />}>
        <React.Suspense fallback={<BuilderEmbeddedSkeleton />}>
          <LazyChartsBuilderPage />
        </React.Suspense>
      </ClientOnly>
    </BuilderRouteReady>
  )
}
