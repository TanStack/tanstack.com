import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  CaretDownIcon,
  CaretRightIcon,
  ArrowsDownUpIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react'
import { liveActions } from '~/utils/analytics/live'
import {
  companyBreakdown,
  groupLiveCompanies,
  type LiveCompanyRow,
  type LiveData,
  type LiveTab,
} from '~/utils/analytics/live-dashboard'
import {
  CompanyBreakdownChart,
  LiveCompanyTrend,
  type CompanySample,
} from './LiveCompanyCharts'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
})
const initialSorting: SortingState = [{ id: 'name', desc: false }]
const columns: ColumnDef<typeof features, LiveCompanyRow>[] = [
  { accessorKey: 'name', header: 'Company', sortFn: sortFn_alphanumeric },
  {
    id: 'industry',
    accessorFn: (row) => row.company?.industry ?? '',
    header: 'Industry',
    sortFn: sortFn_alphanumeric,
  },
  {
    id: 'size',
    accessorFn: (row) => row.company?.company_size ?? '',
    header: 'Company size',
    enableSorting: false,
  },
  {
    id: 'libraries',
    accessorFn: (row) => row.libraries.join(', '),
    header: 'On site',
    enableSorting: false,
  },
  {
    id: 'pages',
    accessorFn: (row) => row.pages.length,
    header: 'Pages now',
    sortFn: sortFn_basic,
  },
  { accessorKey: 'actions', header: 'Actions · 5m', sortFn: sortFn_basic },
  { accessorKey: 'lastSeen', header: 'Last seen', sortFn: sortFn_basic },
]
const lookupLabels: Record<string, string> = {
  pending: 'Looking up company',
  unknown: 'No cached company match',
  failed: 'Company lookup failed',
  unconfigured: 'Company lookup not configured',
}
function age(time: Date | string | number, now: string) {
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

export function LiveVisitors({ data }: { data: LiveData }) {
  const [expanded, setExpanded] = useState(new Set<string>())
  const [showRecent, setShowRecent] = useState(false)
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState(initialSorting)
  const initialSamples: CompanySample[] = []
  const [samples, setSamples] = useState(initialSamples)
  const activeCompanies = useMemo(() => groupLiveCompanies(data, false), [data])
  const count = activeCompanies.filter((company) => company.id).length
  useEffect(() => {
    const time = new Date(data.now).getTime()
    setSamples((previous) =>
      previous.at(-1)?.time === time
        ? previous
        : [
            ...previous.filter((sample) => sample.time >= time - 5 * 60_000),
            { time, companies: count },
          ],
    )
  }, [data.now, count])
  const companies = useMemo(
    () =>
      groupLiveCompanies(data, showRecent).filter((row) =>
        `${row.name} ${row.id} ${row.company?.industry ?? ''} ${row.libraries.join(' ')} ${row.sessions
          .flat()
          .map((tab) => tab.page)
          .join(' ')}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [data, showRecent, search],
  )
  const table = useTable({
    features,
    columns,
    data: companies,
    getRowId: (row) => row.id || 'unmatched',
    state: { sorting },
    onSortingChange: setSorting,
  })
  const sorted = table.getRowModel().rows
  const rows = [
    ...sorted.filter((row) => row.original.id),
    ...sorted.filter((row) => !row.original.id),
  ]
  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <div className="space-y-6">
      {!data.enabled && (
        <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-sm">
          Visitor collection is off.
        </p>
      )}
      {!data.lookupConfigured && (
        <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-sm">
          Company matching needs the Scarf lookup key.
        </p>
      )}
      {data.truncated && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
          Overview and grid cover the 500 most recently seen tabs.
        </p>
      )}
      <div className="grid overflow-hidden rounded-2xl border border-gray-500/15 bg-white/60 divide-y divide-gray-500/15 lg:grid-cols-3 lg:divide-x lg:divide-y-0 dark:bg-gray-900/30">
        <LiveCompanyTrend samples={samples} count={count} />
        <CompanyBreakdownChart
          title="Companies by library"
          items={companyBreakdown(activeCompanies, 'library')}
          color="#6366f1"
          note="A company can appear in more than one library. Other combines the remaining library counts."
        />
        <CompanyBreakdownChart
          title="Industries"
          items={companyBreakdown(activeCompanies, 'industry')}
          color="#0ea5e9"
        />
      </div>
      <section
        className="overflow-hidden rounded-2xl border border-gray-500/15 bg-white/60 dark:bg-gray-900/30"
        aria-label="Companies on site"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <h2 className="text-base font-semibold">
            Companies on site{' '}
            <span className="ml-2 font-mono text-sm font-normal text-gray-500">
              {companies.filter((row) => row.id).length}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={showRecent}
                onChange={(event) => setShowRecent(event.target.checked)}
                className="accent-emerald-600"
              />
              Include recently left
            </label>
            <div className="relative">
              <MagnifyingGlassIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-2.5 text-gray-400"
              />
              <input
                aria-label="Search companies or pages"
                placeholder="Search companies or pages"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-64 max-w-full rounded-lg border border-gray-500/20 bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-left text-sm"
            aria-label="Live companies"
          >
            <thead className="border-y border-gray-500/15 bg-gray-500/[0.035] text-[11px] text-gray-500">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const sort = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        title={
                          header.id === 'actions'
                            ? 'Recorded interactions in the last five minutes, limited to 40 recent events per tab.'
                            : undefined
                        }
                        aria-sort={
                          sort === 'asc'
                            ? 'ascending'
                            : sort === 'desc'
                              ? 'descending'
                              : undefined
                        }
                        className="whitespace-nowrap px-4 py-3 font-medium first:pl-5"
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 rounded-sm hover:text-gray-900 focus-visible:outline focus-visible:outline-emerald-500 dark:hover:text-gray-100"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <table.FlexRender header={header} />
                            {sort ? (
                              <span aria-hidden="true">
                                {sort === 'asc' ? '↑' : '↓'}
                              </span>
                            ) : (
                              <ArrowsDownUpIcon
                                aria-hidden="true"
                                className="opacity-40"
                              />
                            )}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-500/10">
              {rows.map((row) => {
                const company = row.original
                const open = expanded.has(row.id)
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`hover:bg-gray-500/[0.035] ${open ? 'bg-emerald-500/[0.035]' : ''}`}
                    >
                      <td className="min-w-60 py-4 pl-5 pr-4">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={`company-${row.id}`}
                          onClick={() => toggle(row.id)}
                          className="flex w-full items-center gap-3 text-left rounded-sm focus-visible:outline focus-visible:outline-emerald-500"
                        >
                          {open ? (
                            <CaretDownIcon
                              aria-hidden="true"
                              className="shrink-0 text-gray-400"
                            />
                          ) : (
                            <CaretRightIcon
                              aria-hidden="true"
                              className="shrink-0 text-gray-400"
                            />
                          )}
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${company.id ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-gray-500/10 text-gray-500'}`}
                            aria-hidden="true"
                          >
                            {company.id
                              ? company.name.slice(0, 1).toUpperCase()
                              : '?'}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">
                              {company.name}
                            </span>
                            {company.id &&
                              company.name.toLowerCase() !== company.id && (
                                <span className="mt-0.5 block text-xs text-gray-500">
                                  {company.id}
                                </span>
                              )}
                            {!company.active && (
                              <span className="mt-0.5 block text-xs text-gray-500">
                                Recently left
                              </span>
                            )}
                          </span>
                        </button>
                      </td>
                      <td className="max-w-44 px-4 py-4 text-xs text-gray-500">
                        <span className="line-clamp-2">
                          {company.company?.industry || 'Unknown'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-gray-500">
                        {company.company?.company_size || 'Unknown'}
                      </td>
                      <td className="min-w-32 px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {company.libraries.slice(0, 2).map((library) => (
                            <span
                              key={library}
                              className="rounded bg-gray-500/[0.07] px-2 py-1 text-[11px]"
                            >
                              {library}
                            </span>
                          ))}
                          {company.libraries.length > 2 && (
                            <span
                              title={company.libraries.slice(2).join(', ')}
                              className="px-1 py-1 text-[11px] text-gray-500"
                            >
                              +{company.libraries.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs tabular-nums">
                        {company.pages.length}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs tabular-nums">
                        {company.actions}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-gray-500">
                        <span
                          className={`mr-2 inline-block size-1.5 rounded-full ${company.active ? 'bg-emerald-500' : 'bg-gray-400'}`}
                          aria-hidden="true"
                        />
                        {age(company.lastSeen, data.now)}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="bg-gray-500/[0.025] p-3 sm:p-5"
                        >
                          <CompanySessions company={company} now={data.now} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-5 py-16 text-center text-sm text-gray-500"
                  >
                    {search
                      ? 'No companies or pages match your search.'
                      : 'No companies on public pages right now.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-gray-500/10 px-5 py-3 text-[11px] text-gray-500">
          <span>
            Company matches describe the network, not a verified employer.
          </span>
          <span>Missing heartbeats expire after 65 seconds.</span>
        </div>
      </section>
    </div>
  )
}

function CompanySessions({
  company,
  now,
}: {
  company: LiveCompanyRow
  now: string
}) {
  return (
    <div
      id={`company-${company.id || 'unmatched'}`}
      className="overflow-hidden rounded-xl border border-gray-500/15 bg-white/70 dark:bg-gray-950/40"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-gray-500/10 px-4 py-3">
        <h3 className="text-xs font-semibold">Sessions at {company.name}</h3>
        <span className="text-xs text-gray-500">
          {
            company.sessions.filter((tabs) => tabs.some((tab) => tab.active))
              .length
          }{' '}
          active · {company.sessions.length} in view
        </span>
      </div>
      <div className="max-h-[32rem] divide-y divide-gray-500/10 overflow-y-auto">
        {company.sessions.map((tabs) => (
          <SessionDetails key={tabs[0].sessionId} tabs={tabs} now={now} />
        ))}
      </div>
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
          {age(current.lastSeen, now)}
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
            Arrived {age(first.arrivedAt, now)}
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
                    {age(event.at, now)}
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
