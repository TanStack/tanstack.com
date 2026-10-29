import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { UsersIcon } from '@phosphor-icons/react'
import { useAdminGuard } from '~/hooks/useAdminGuard'
import {
  AdminAccessDenied,
  AdminLoading,
  AdminPageHeader,
} from '~/components/admin'
import { LiveVisitors } from '~/components/admin/LiveVisitors'
import { getLiveVisitors } from '~/utils/analytics/live.functions'

export const Route = createFileRoute('/admin/live')({
  component: LiveVisitorsPage,
})

function LiveVisitorsPage() {
  const guard = useAdminGuard()
  const query = useQuery({
    queryKey: ['admin', 'live-visitors'],
    queryFn: () => getLiveVisitors(),
    enabled: guard.status === 'authorized',
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    retry: false,
  })
  if (guard.status === 'loading') return <AdminLoading />
  if (guard.status === 'denied') return <AdminAccessDenied />
  return (
    <div className="w-full max-w-7xl space-y-6 p-4 md:p-6">
      <AdminPageHeader
        icon={<UsersIcon />}
        title="Live visitors"
        actions={
          <span role="status" className="text-xs text-gray-500">
            {query.isError
              ? 'Updates interrupted'
              : query.data
                ? `Updated ${new Date(query.data.now).toLocaleTimeString()}`
                : 'Connecting'}
          </span>
        }
      />
      {query.isPending && <AdminLoading />}
      {query.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg bg-red-500/10 p-3 text-sm"
        >
          <p>Couldn’t load live visitors. The last view may be out of date.</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="underline"
          >
            Retry
          </button>
        </div>
      )}
      {query.data && <LiveVisitors data={query.data} />}
    </div>
  )
}
