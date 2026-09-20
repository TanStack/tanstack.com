import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  BuilderEmbeddedSkeleton,
  BuilderIndexSkeleton,
  BuilderRouteReady,
} from '~/components/builder/BuilderLoading'
import { seo } from '~/utils/seo'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const LazyChartsBuilderPage = React.lazy(() =>
  import('~/components/charts/ChartsBuilderPage.client').then((module) => ({
    default: module.ChartsBuilderPage,
  })),
)

const LazySharedExamplePage = React.lazy(() =>
  import('~/components/examples/SharedExamplePage.client').then((module) => ({
    default: module.SharedExamplePage,
  })),
)

const LazyBuilderIndexPage = React.lazy(() =>
  import('~/components/builder/BuilderIndexPage.client').then((module) => ({
    default: module.BuilderIndexPage,
  })),
)

export const Route = createFileRoute('/builder')({
  ssr: false,
  pendingComponent: BuilderIndexSkeleton,
  component: ChartsBuilderRoute,
  headers: () => webContainerHeaders,
  head: () => ({
    meta: seo({
      title: 'TanStack Builder',
      description:
        'Create, run, and share browser sandboxes for TypeScript and TanStack projects.',
    }),
    links: [
      {
        rel: 'alternate',
        type: 'text/plain',
        href: '/builder/llms.txt',
        title: 'TanStack Builder authoring guide',
      },
    ],
  }),
})

function ChartsBuilderRoute() {
  return (
    <BuilderRouteReady>
      <ClientOnly fallback={<BuilderIndexSkeleton />}>
        <BuilderClientPage />
      </ClientOnly>
    </BuilderRouteReady>
  )
}

function BuilderClientPage() {
  if (window.location.hash.startsWith('#project=')) {
    return (
      <React.Suspense fallback={<BuilderEmbeddedSkeleton />}>
        <LazySharedExamplePage />
      </React.Suspense>
    )
  }

  if (window.location.hash.startsWith('#code=')) {
    return (
      <React.Suspense fallback={<BuilderEmbeddedSkeleton />}>
        <LazyChartsBuilderPage />
      </React.Suspense>
    )
  }

  return (
    <React.Suspense fallback={<BuilderIndexSkeleton />}>
      <LazyBuilderIndexPage />
    </React.Suspense>
  )
}
