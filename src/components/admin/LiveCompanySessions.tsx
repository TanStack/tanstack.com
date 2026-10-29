import { useQuery } from '@tanstack/react-query'
import { CaretRightIcon, CaretDownIcon } from '@phosphor-icons/react'
import { getLiveCompanySessions } from '~/utils/analytics/live.functions'
import {
  groupLiveCompanies,
  type LiveTab,
} from '~/utils/analytics/live-dashboard'
import { liveActions } from '~/utils/analytics/live'

const lookupLabels: Record<string, string> = {
  pending: 'Looking up company',
  unknown: 'No cached company match',
  failed: 'Company lookup failed',
  rate_limited: 'Company lookup rate limited',
  unconfigured: 'Company lookup not configured',
}
function liveAge(time: Date | string | number, now: string) {
  const seconds = Math.max(
    0,
    Math.floor((new Date(now).getTime() - new Date(time).getTime()) / 1000),
  )
  return seconds < 5
    ? 'Just now'
    : seconds < 60
      ? `${seconds}s ago`
      : `${Math.floor(seconds / 60)}m ago`
}
export function LiveCompanySessions({
  domain,
  paused,
}: {
  domain: string
  paused: boolean
}) {
  const query = useQuery({
    queryKey: ['admin', 'live-company-sessions', domain],
    queryFn: () => getLiveCompanySessions({ data: { domain } }),
    refetchInterval: paused ? false : 3000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: !paused,
    retry: false,
  })
  if (query.isPending)
    return <p className="p-3 text-xs text-gray-500">Loading sessions...</p>
  if (query.isError)
    return (
      <div className="flex items-center gap-3 p-3 text-xs">
        <p>Could not load sessions.</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="underline"
        >
          Retry
        </button>
      </div>
    )
  const sessions = groupLiveCompanies(query.data, true).flatMap(
    (company) => company.sessions,
  )
  return (
    <div className="max-h-96 overflow-y-auto divide-y divide-gray-500/10">
      {query.data.truncated && (
        <p className="px-4 py-2 text-xs text-amber-600">
          Showing this company's 500 most recently seen tabs.
        </p>
      )}
      {sessions.length ? (
        sessions.map((tabs) => (
          <SessionDetails
            key={tabs[0].sessionId}
            tabs={tabs}
            now={query.data.now}
          />
        ))
      ) : (
        <p className="p-3 text-xs text-gray-500">No recent sessions remain.</p>
      )}
    </div>
  )
}

function SessionDetails({ tabs, now }: { tabs: LiveTab[]; now: string }) {
  const first = tabs[0]
  const current =
    tabs.find((tab) => tab.active && tab.visible) ??
    tabs.find((tab) => tab.active) ??
    first
  const active = tabs.some((tab) => tab.active)
  const activity = tabs
    .flatMap((tab) => tab.activity)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 40)
  return (
    <details className="group/session">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs hover:bg-gray-500/[0.035] [&::-webkit-details-marker]:hidden">
        <CaretRightIcon
          aria-hidden="true"
          className="text-gray-400 group-open/session:hidden"
        />
        <CaretDownIcon
          aria-hidden="true"
          className="hidden text-gray-400 group-open/session:block"
        />
        <span className="font-mono">Visitor {first.sessionId.slice(0, 8)}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] ${active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-gray-500/10 text-gray-500'}`}
        >
          {active ? (current.visible ? 'Visible' : 'Background') : 'Left'}
        </span>
        <span className="min-w-0 flex-1 truncate text-gray-500">
          {current.page}
        </span>
        {!first.company && (
          <span className="text-[10px] text-gray-500">
            {lookupLabels[first.lookupStatus]}
          </span>
        )}
        <span className="ml-auto text-gray-500">
          {liveAge(current.lastSeen, now)}
        </span>
      </summary>
      <div className="grid gap-6 border-t border-gray-500/10 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:pl-12">
        <section>
          <h4 className="mb-3 text-xs font-medium">
            Tabs <span className="ml-1 text-gray-500">{tabs.length}</span>
          </h4>
          <ul className="space-y-3">
            {tabs.map((tab) => (
              <li key={tab.tabId} className="text-xs">
                <span className="mb-1 block text-[10px] text-gray-500">
                  {tab.active
                    ? tab.visible
                      ? 'Visible'
                      : 'Background'
                    : 'Left'}
                </span>
                <span className="break-all">{tab.page}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[10px] text-gray-500">
            Arrived {liveAge(first.arrivedAt, now)}
          </p>
        </section>
        <section>
          <h4 className="mb-3 text-xs font-medium">Recent activity</h4>
          {activity.length ? (
            <ol className="space-y-3">
              {activity.map((event, index) => (
                <li key={`${event.at}-${index}`} className="flex gap-4 text-xs">
                  <time
                    dateTime={event.at}
                    className="w-16 shrink-0 text-[10px] text-gray-500"
                  >
                    {liveAge(event.at, now)}
                  </time>
                  <div className="min-w-0">
                    <p>{liveActions[event.action]}</p>
                    <p className="mt-1 break-all text-[11px] text-gray-500">
                      {event.page}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-gray-500">No actions recorded yet.</p>
          )}
        </section>
      </div>
    </details>
  )
}
