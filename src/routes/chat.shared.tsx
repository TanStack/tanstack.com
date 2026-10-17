import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  BuilderEmbeddedSkeleton,
  BuilderRouteReady,
} from '~/chat/components/projects/Loading'
import { seo } from '~/utils/seo'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazySharedExamplePage = React.lazy(() =>
  import('~/components/examples/SharedExamplePage.client').then((module) => ({
    default: module.SharedExamplePage,
  })),
)

export const Route = createFileRoute('/chat/shared')({
  ssr: false,
  pendingComponent: BuilderEmbeddedSkeleton,
  component: SharedBuilderRoute,
  headers: () => webContainerHeaders,
  head: () => ({
    meta: seo({
      title: 'Project snapshot | TanStack',
      description: 'Run and inspect a public TanStack project.',
      noindex: true,
    }),
  }),
})

function SharedBuilderRoute() {
  return (
    <BuilderRouteReady>
      <ClientOnly fallback={<BuilderEmbeddedSkeleton />}>
        <React.Suspense fallback={<BuilderEmbeddedSkeleton />}>
          <LazySharedExamplePage />
        </React.Suspense>
      </ClientOnly>
    </BuilderRouteReady>
  )
}
