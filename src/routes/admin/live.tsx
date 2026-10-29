import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BuildingsIcon,
  PauseIcon,
  PlayIcon,
  ArrowClockwiseIcon,
} from '@phosphor-icons/react'
import { useAdminGuard } from '~/hooks/useAdminGuard'
import { AdminAccessDenied, AdminLoading } from '~/components/admin'
import { LiveVisitors } from '~/components/admin/LiveVisitors'
import { getLiveCompanyOverview } from '~/utils/analytics/live.functions'

export const Route = createFileRoute('/admin/live')({
  component: LiveVisitorsPage,
})
function LiveVisitorsPage() {
  const guard = useAdminGuard()
  const [paused, setPaused] = useState(false)
  const query = useQuery({
    queryKey: ['admin', 'live-company-overview'],
    queryFn: () => getLiveCompanyOverview(),
    enabled: guard.status === 'authorized',
    refetchInterval: paused ? false : 3000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: !paused,
    retry: false,
  })
  if (guard.status === 'loading') return <AdminLoading />
  if (guard.status === 'denied') return <AdminAccessDenied />
  return (
    <div className="w-full min-w-0 space-y-3 p-3 md:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <BuildingsIcon className="size-4 text-gray-500" />
          Live companies
        </h1>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-gray-500">
            {query.isError
              ? 'Updates interrupted'
              : paused
                ? 'Paused'
                : query.data
                  ? `Updated ${new Date(query.data.now).toLocaleTimeString()}`
                  : 'Connecting'}
          </span>
          <button
            type="button"
            aria-pressed={paused}
            onClick={() => setPaused((previous) => !previous)}
            className="flex h-7 items-center gap-1 rounded border border-gray-500/20 px-2"
          >
            {paused ? (
              <PlayIcon aria-hidden="true" />
            ) : (
              <PauseIcon aria-hidden="true" />
            )}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            aria-label="Refresh live companies"
            title="Refresh live company activity"
            onClick={() => query.refetch()}
            className="rounded border border-gray-500/20 p-1.5"
          >
            <ArrowClockwiseIcon aria-hidden="true" />
          </button>
        </div>
      </header>
      {query.isPending && <AdminLoading />}
      {query.isError && (
        <div
          role="alert"
          className="flex items-center gap-3 border border-red-500/20 bg-red-500/10 p-2 text-xs"
        >
          <p>Could not refresh companies. The last view may be out of date.</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="underline"
          >
            Retry
          </button>
        </div>
      )}
      {query.data && <LiveVisitors data={query.data} paused={paused} />}
    </div>
  )
}
