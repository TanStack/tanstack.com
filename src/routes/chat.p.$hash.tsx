import * as React from 'react'
import { createClientOnlyFn } from '@tanstack/react-start'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  BuilderEmbeddedSkeleton,
  BuilderRouteReady,
} from '~/chat/components/projects/Loading'
import { seo } from '~/utils/seo'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazySharedExamplePage = React.lazy(
  createClientOnlyFn(() =>
    import('~/components/examples/SharedExamplePage.client').then((module) => ({
      default: module.SharedExamplePage,
    })),
  ),
)

export const Route = createFileRoute('/chat/p/$hash')({
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
