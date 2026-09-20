import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  BuilderEmbeddedSkeleton,
  BuilderRouteReady,
} from '~/components/builder/BuilderLoading'
import { seo } from '~/utils/seo'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazySharedExamplePage = React.lazy(() =>
  import('~/components/examples/SharedExamplePage.client').then((module) => ({
    default: module.SharedExamplePage,
  })),
)

export const Route = createFileRoute('/builder_/p/$hash')({
  ssr: false,
  pendingComponent: BuilderEmbeddedSkeleton,
  component: SharedBuilderRoute,
  headers: () => webContainerHeaders,
  head: () => ({
    meta: seo({
      title: 'Project snapshot | TanStack Builder',
      description: 'Run and inspect a public TanStack Builder project.',
      noindex: true,
    }),
  }),
})

function SharedBuilderRoute() {
  const { hash } = Route.useParams()

  return (
    <BuilderRouteReady>
      <ClientOnly fallback={<BuilderEmbeddedSkeleton />}>
        <React.Suspense fallback={<BuilderEmbeddedSkeleton />}>
          <LazySharedExamplePage hash={hash} />
        </React.Suspense>
      </ClientOnly>
    </BuilderRouteReady>
  )
}
