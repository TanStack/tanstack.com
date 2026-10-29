import { lazy, Suspense, useEffect, useState } from 'react'
import { z } from 'zod'
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
const VisitorChats = lazy(
  () => import('~/components/visitor-chat/AdminVisitorChats'),
)
const chatTargetSchema = z.object({
  sessionId: z.uuid(),
  label: z.string(),
  chatId: z.uuid().nullable().optional(),
})
function LiveVisitorsPage() {
  const guard = useAdminGuard()
  const [paused, setPaused] = useState(false)
  const [chatRequest, setChatRequest] = useState(0)
  const [chatTarget, setChatTarget] = useState(
    (): z.infer<typeof chatTargetSchema> | null => null,
  )
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
  useEffect(() => {
    const open = (event: Event) => {
      if (!(event instanceof CustomEvent) || !query.data?.chatEnabled) return
      const target = chatTargetSchema.safeParse(event.detail)
      if (!target.success) return
      setChatTarget(target.data)
      setChatRequest((value) => value + 1)
    }
    window.addEventListener('tanstack:start-visitor-chat', open)
    return () => window.removeEventListener('tanstack:start-visitor-chat', open)
  }, [query.data?.chatEnabled])
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
          {query.data?.chatEnabled && (
            <button
              type="button"
              className="h-7 rounded border border-gray-500/20 px-2"
              onClick={() => {
                setChatTarget(null)
                setChatRequest((value) => value + 1)
              }}
            >
              Chats
              {Boolean(query.data.chatsNeedingReply) && (
                <span
                  className="ml-1 rounded bg-emerald-500/15 px-1 font-mono text-emerald-600 dark:text-emerald-400"
                  title="Chats whose latest message is from the visitor"
                >
                  {query.data.chatsNeedingReply}
                </span>
              )}
            </button>
          )}
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
      {query.data?.chatEnabled && (
        <Suspense
          fallback={
            <p className="fixed right-4 bottom-0 z-50 rounded bg-white p-3 text-xs dark:bg-gray-950">
              Loading chats...
            </p>
          }
        >
          <VisitorChats target={chatTarget} request={chatRequest} />
        </Suspense>
      )}
    </div>
  )
}
