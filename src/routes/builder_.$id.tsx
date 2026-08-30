import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  BuilderEditorSkeleton,
  BuilderRouteReady,
} from '~/components/builder/BuilderLoading'
import { seo } from '~/utils/seo'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazyBuilderProjectPage = React.lazy(() =>
  import('~/components/builder/BuilderProjectPage.client').then((module) => ({
    default: module.BuilderProjectPage,
  })),
)

export const Route = createFileRoute('/builder_/$id')({
  ssr: false,
  pendingComponent: BuilderEditorSkeleton,
  component: BuilderRoute,
  headers: () => webContainerHeaders,
  head: () => ({
    meta: seo({
      title: 'Builder | TanStack',
      description: 'Run and inspect a public TanStack Builder project.',
      noindex: true,
    }),
  }),
})

function BuilderRoute() {
  const { id } = Route.useParams()

  return (
    <BuilderRouteReady>
      <ClientOnly fallback={<BuilderEditorSkeleton />}>
        <React.Suspense fallback={<BuilderEditorSkeleton />}>
          <LazyBuilderProjectPage key={id} id={id} />
        </React.Suspense>
      </ClientOnly>
    </BuilderRouteReady>
  )
}
