import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import {
  dashboardOptions,
  snapshotOptions,
} from '~/components/dashboard/query-options'
import { serverRequestSchema } from '~/components/dashboard/request'
import { dashboardSearch } from '~/components/dashboard/model'

const Dashboard = lazy(() => import('~/components/dashboard/Dashboard.client'))
export const Route = createFileRoute('/examples/dashboard')({
  ssr: false,
  preloadStaleTime: 0,
  staticData: { showNavbar: false },
  validateSearch: (search) => dashboardSearch.parse(search),
  loaderDeps: ({ search }) => ({
    source: search.source,
    day: search.day,
    zone: search.zone,
    borough: search.borough,
    grid: search.grid,
    selected: search.selected,
  }),
  loader: ({ context, deps, cause }) => {
    // Start the request alongside the lazy UI on entry. Query owns later
    // parameter changes, so route loaders do not bypass input debouncing.
    if (cause === 'stay') return
    if (deps.source === 'client')
      void context.queryClient.prefetchQuery(snapshotOptions)
    else
      void context.queryClient.prefetchQuery(
        dashboardOptions(
          serverRequestSchema.parse({
            ...deps,
            selection: { all: false, ids: [] },
          }),
        ),
      )
  },
  head: () => ({ meta: [{ title: 'NYC taxi dashboard | TanStack' }] }),
  component: () => (
    <ClientOnly>
      <Suspense
        fallback={
          <p role="status" className="p-8">
            Loading dashboard…
          </p>
        }
      >
        <Dashboard />
      </Suspense>
    </ClientOnly>
  ),
})
