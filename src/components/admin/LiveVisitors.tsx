import { useState } from 'react'
import { liveActions } from '~/utils/analytics/live'
import type { getLiveVisitors } from '~/utils/analytics/live.functions'

type LiveData = Awaited<ReturnType<typeof getLiveVisitors>>
type LiveTab = LiveData['tabs'][number]

const lookupLabels: Record<string, string> = {
  pending: 'Looking up company',
  unknown: 'No cached company match',
  failed: 'Company lookup failed',
  unconfigured: 'Company lookup not configured',
}

function age(time: Date | string, now: string) {
  const seconds = Math.max(
    0,
    Math.floor((new Date(now).getTime() - new Date(time).getTime()) / 1000),
  )
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`
}

export function LiveVisitors({ data }: { data: LiveData }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showRecent, setShowRecent] = useState(false)
  const [search, setSearch] = useState('')
  const sessions = new Map<string, LiveTab[]>()
  for (const tab of data.tabs) {
    const tabs = sessions.get(tab.sessionId) ?? []
    tabs.push(tab)
    sessions.set(tab.sessionId, tabs)
  }
  const companies = new Map<string, { name: string; sessions: LiveTab[][] }>()
  for (const tabs of sessions.values()) {
    if (!showRecent && !tabs.some((tab) => tab.active)) continue
    const first = tabs[0]
    const domain = first.company?.domain ?? ''
    const name = first.company?.name || domain || 'Unknown company'
    if (
      search &&
      !`${name} ${domain} ${tabs.map((tab) => tab.page).join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      continue
    const company = companies.get(domain) ?? { name, sessions: [] }
    company.sessions.push(tabs)
    companies.set(domain, company)
  }
  const selectedTabs = selected ? sessions.get(selected) : undefined
  const activity =
    selectedTabs
      ?.flatMap((tab) => tab.activity)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 40) ?? []
  const activeCount = [...sessions.values()].filter((tabs) =>
    tabs.some((tab) => tab.active),
  ).length
  const selectedCompany = selectedTabs?.[0].company

  return (
    <div className="space-y-5">
      {!data.enabled && (
        <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-sm">
          Visitor collection is off.
        </p>
      )}
      {!data.lookupConfigured && (
        <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-sm">
          Company matching needs the Scarf lookup key. Anonymous sessions still
          appear when collection is on.
        </p>
      )}
      {data.truncated && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
          Showing the 500 most recently seen tabs.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <p className="mr-auto text-sm text-gray-600 dark:text-gray-400">
          {activeCount} active {activeCount === 1 ? 'session' : 'sessions'}
        </p>
        <input
          aria-label="Filter companies or pages"
          placeholder="Filter companies or pages"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-lg border border-gray-500/20 bg-transparent px-3 py-2 text-sm sm:w-64"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showRecent}
            onChange={(event) => setShowRecent(event.target.checked)}
          />
          Include recently left
        </label>
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.75fr)]">
        <div className="min-w-0 space-y-5">
          {companies.size === 0 && (
            <p className="py-12 text-center text-sm text-gray-500">
              {search
                ? 'No matching companies or pages.'
                : 'No visitors on public pages right now.'}
            </p>
          )}
          {[...companies.entries()].map(([domain, company]) => (
            <section
              key={domain}
              className="overflow-hidden rounded-xl border border-gray-500/20"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-gray-500/5 px-4 py-3">
                <h2 className="font-semibold">{company.name}</h2>
                {domain && (
                  <span className="text-xs text-gray-500">
                    Matched company · {domain}
                  </span>
                )}
              </div>
              <ul className="divide-y divide-gray-500/10">
                {company.sessions.map((tabs) => {
                  const first = tabs[0]
                  const active = tabs.some((tab) => tab.active)
                  const current =
                    tabs.find((tab) => tab.active && tab.visible) ??
                    tabs.find((tab) => tab.active) ??
                    first
                  return (
                    <li key={first.sessionId}>
                      <button
                        type="button"
                        aria-pressed={selected === first.sessionId}
                        onClick={() => setSelected(first.sessionId)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-500/5 ${selected === first.sessionId ? 'bg-blue-500/10' : ''}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400'}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-mono text-sm">
                              Visitor {first.sessionId.slice(0, 8)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {active
                                ? current.visible
                                  ? 'Visible'
                                  : 'Background'
                                : 'Left'}{' '}
                              · {age(first.lastSeen, data.now)} ago
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-sm">
                            {current.page}
                          </span>
                          {!first.company && (
                            <span className="mt-1 block text-xs text-gray-500">
                              {lookupLabels[first.lookupStatus]}
                            </span>
                          )}
                          {tabs.filter((tab) => tab.active).length > 1 && (
                            <span className="mt-1 block text-xs text-gray-500">
                              {tabs.filter((tab) => tab.active).length} open
                              tabs
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
        <aside className="min-w-0 rounded-xl border border-gray-500/20 p-4 xl:self-start xl:sticky xl:top-20">
          {!selectedTabs ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Select a session to see its activity.
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">
                  Visitor {selected?.slice(0, 8)}
                </h2>
                <button
                  type="button"
                  aria-label="Close session activity"
                  onClick={() => setSelected(null)}
                  className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Close
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Arrived {age(selectedTabs[0].arrivedAt, data.now)} ago
              </p>
              {selectedCompany && (
                <p className="mt-3 text-sm">
                  {selectedCompany.name || selectedCompany.domain}
                  {selectedCompany.industry && ` · ${selectedCompany.industry}`}
                  {selectedCompany.company_size &&
                    ` · ${selectedCompany.company_size} employees`}
                </p>
              )}
              <ul className="mt-4 space-y-2 border-b border-gray-500/20 pb-4">
                {selectedTabs.map((tab) => (
                  <li key={tab.tabId} className="flex gap-3 text-xs">
                    <span className="w-20 shrink-0 text-gray-500">
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
              <h3 className="mt-4 text-sm font-semibold">Recent activity</h3>
              {activity.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">
                  No actions recorded yet.
                </p>
              ) : (
                <ol className="mt-4 space-y-4">
                  {activity.map((event, index) => (
                    <li
                      key={`${event.at}-${index}`}
                      className="flex gap-3 text-sm"
                    >
                      <time
                        dateTime={event.at}
                        className="w-10 shrink-0 text-xs text-gray-500"
                      >
                        {age(event.at, data.now)}
                      </time>
                      <div className="min-w-0">
                        <p>{liveActions[event.action]}</p>
                        <p className="mt-0.5 break-all text-xs text-gray-500">
                          {event.page}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
          {selected && !selectedTabs && (
            <p className="mt-3 text-sm text-gray-500">
              This session has expired.
            </p>
          )}
        </aside>
      </div>
      <p className="text-xs text-gray-500">
        Sessions can include multiple tabs. Departures may take about a minute
        to appear. Company matches describe the network, not a verified
        employer.
      </p>
    </div>
  )
}
