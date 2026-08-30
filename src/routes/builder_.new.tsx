import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import {
  BuilderProjectDraftSkeleton,
  BuilderRouteReady,
} from '~/components/builder/BuilderLoading'
import { seo } from '~/utils/seo'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazyBuilderProjectDraftPage = React.lazy(() =>
  import('~/components/builder/BuilderProjectDraftPage.client').then(
    (module) => ({
      default: module.BuilderProjectDraftPage,
    }),
  ),
)

export const Route = createFileRoute('/builder_/new')({
  ssr: false,
  pendingComponent: BuilderProjectDraftSkeleton,
  validateSearch: v.object({
    template: v.optional(v.string()),
  }),
  component: BuilderProjectDraftRoute,
  headers: () => webContainerHeaders,
  head: () => ({
    meta: seo({
      title: 'New project | TanStack',
      description: 'Create and run a browser-local TanStack project.',
      noindex: true,
    }),
  }),
})

function BuilderProjectDraftRoute() {
  const { template } = Route.useSearch()

  return (
    <BuilderRouteReady>
      <ClientOnly fallback={<BuilderProjectDraftSkeleton />}>
        <React.Suspense fallback={<BuilderProjectDraftSkeleton />}>
          <LazyBuilderProjectDraftPage template={template} />
        </React.Suspense>
      </ClientOnly>
    </BuilderRouteReady>
  )
}
