import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { csvFormat } from 'd3'
import {
  createSortedRowModel,
  createPaginatedRowModel,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type ColumnVisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  ArrowsDownUpIcon,
  CaretDownIcon,
  CaretRightIcon,
  MagnifyingGlassIcon,
  XIcon,
  DownloadSimpleIcon,
  ColumnsIcon,
} from '@phosphor-icons/react'
import { getScarfCompanyHistory } from '~/utils/analytics/live.functions'
import { historyDaysSchema } from '~/utils/analytics/scarf-history'
import {
  buildCompanyGridRows,
  companyFacetCounts,
  companyWidgetItems,
  filterCompanyRows,
  emptyCompanyFilters,
  companyGrowth,
  csvSafeText,
  type CompanyGridRow,
  type CompanyFacet,
  type LiveOverview,
} from '~/utils/analytics/live-dashboard'
import { CompanyBreakdownChart } from './LiveCompanyCharts'
import { CompanyFacetFilter } from './CompanyFacetFilter'
import { LiveCompanySessions } from './LiveCompanySessions'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
  columnVisibilityFeature,
})
const initialSorting: SortingState = [
  { id: 'unmatched', desc: false },
  { id: 'siteViews', desc: true },
  { id: 'actions', desc: true },
  { id: 'sessions', desc: true },
]
const initialPagination: PaginationState = { pageIndex: 0, pageSize: 50 }
const initialVisibility: ColumnVisibilityState = {
  unmatched: false,
  tabs: false,
  recentViews: false,
  siteEvents: false,
  origins: false,
  endpoints: false,
  lastScarfSeen: false,
}
const initialSelection: RowSelectionState = {}
const visibilitySchema = z.record(z.string(), z.boolean())
const facets: CompanyFacet[] = ['library', 'size', 'industry', 'stage']
const widgetFacets: CompanyFacet[] = ['library', 'size', 'industry']
const facetLabels: Record<CompanyFacet, string> = {
  library: 'Library',
  size: 'Company size',
  industry: 'Industry',
  stage: 'Funnel stage',
}
const number = new Intl.NumberFormat('en-US')
function numeric(value: number | undefined) {
  return value === undefined ? (
    <span className="text-gray-400" title="Not reported by Scarf">
      N/A
    </span>
  ) : (
    number.format(value)
  )
}
function age(value: Date, now: string) {
  const seconds = Math.max(
    0,
    Math.floor((new Date(now).getTime() - new Date(value).getTime()) / 1000),
  )
  return seconds < 5
    ? 'Now'
    : seconds < 60
      ? `${seconds}s`
      : `${Math.floor(seconds / 60)}m`
}
function growthLabel(row: CompanyGridRow) {
  const growth = companyGrowth(row)
  if (row.history?.previousViews === 0 && (row.history.views ?? 0) > 0)
    return 'New'
  return growth === undefined
    ? 'N/A'
    : `${growth > 0 ? '+' : ''}${growth.toFixed(0)}%`
}
const columns: ColumnDef<typeof features, CompanyGridRow>[] = [
  {
    id: 'unmatched',
    accessorFn: (row) => (row.id ? 0 : 1),
    sortFn: sortFn_basic,
    enableHiding: false,
  },
  { id: 'select', header: 'Select', enableSorting: false, enableHiding: false },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Company',
    sortFn: sortFn_alphanumeric,
    enableHiding: false,
  },
  {
    id: 'industry',
    accessorKey: 'industry',
    header: 'Industry',
    sortFn: sortFn_alphanumeric,
    cell: ({ row }) => (
      <span className="block max-w-36 truncate" title={row.original.industry}>
        {row.original.industry}
      </span>
    ),
  },
  {
    id: 'size',
    accessorFn: (row) => row.employeeMin,
    header: 'Employees',
    sortFn: sortFn_basic,
    sortUndefined: 'last',
    cell: ({ row }) => row.original.company?.company_size || 'N/A',
  },
  {
    id: 'libraries',
    accessorFn: (row) => row.libraries.join(', '),
    header: 'Libraries',
    sortFn: sortFn_alphanumeric,
    cell: ({ row }) => (
      <span
        className="block max-w-36 truncate"
        title={row.original.libraries.join(', ')}
      >
        {row.original.libraries.join(', ') || 'None active'}
      </span>
    ),
  },
  {
    id: 'sessions',
    accessorKey: 'activeSessions',
    header: 'Sessions',
    sortFn: sortFn_basic,
    cell: ({ row }) => numeric(row.original.activeSessions),
  },
  {
    id: 'tabs',
    accessorKey: 'activeTabs',
    header: 'Tabs',
    sortFn: sortFn_basic,
    cell: ({ row }) => numeric(row.original.activeTabs),
  },
  {
    id: 'actions',
    accessorKey: 'actions',
    header: 'Actions · 5m',
    sortFn: sortFn_basic,
    cell: ({ row }) => numeric(row.original.actions),
  },
  {
    id: 'recentViews',
    accessorKey: 'recentViews',
    header: 'Views · 5m',
    sortFn: sortFn_basic,
    cell: ({ row }) => numeric(row.original.recentViews),
  },
  {
    id: 'siteViews',
    accessorFn: (row) => row.history?.views,
    header: 'Site views',
    sortFn: sortFn_basic,
    sortUndefined: 'last',
    cell: ({ row }) => numeric(row.original.history?.views),
  },
  {
    id: 'growth',
    accessorFn: (row) => companyGrowth(row),
    header: 'Change',
    sortFn: sortFn_basic,
    sortUndefined: 'last',
    cell: ({ row }) => (
      <span
        className={
          (companyGrowth(row.original) ?? 0) > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : (companyGrowth(row.original) ?? 0) < 0
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-gray-500'
        }
      >
        {growthLabel(row.original)}
      </span>
    ),
  },
  {
    id: 'siteEvents',
    accessorFn: (row) => row.history?.siteEvents,
    header: 'Site events',
    sortFn: sortFn_basic,
    sortUndefined: 'last',
    cell: ({ row }) => numeric(row.original.history?.siteEvents),
  },
  {
    id: 'origins',
    accessorFn: (row) => row.history?.origins,
    header: 'Sources',
    sortFn: sortFn_basic,
    sortUndefined: 'last',
    cell: ({ row }) => numeric(row.original.history?.origins),
  },
  {
    id: 'endpoints',
    accessorFn: (row) => row.history?.endpoints,
    header: 'Endpoints',
    sortFn: sortFn_basic,
    sortUndefined: 'last',
    cell: ({ row }) => numeric(row.original.history?.endpoints),
  },
  {
    id: 'stage',
    accessorFn: (row) => row.history?.stage,
    header: 'Funnel stage',
    sortFn: sortFn_alphanumeric,
    sortUndefined: 'last',
    cell: ({ row }) => (
      <span className="capitalize">
        {row.original.history?.stage?.replaceAll('-', ' ') || 'N/A'}
      </span>
    ),
  },
  {
    id: 'lastScarfSeen',
    accessorFn: (row) => row.history?.lastSeen,
    header: 'Scarf last seen',
    sortFn: sortFn_alphanumeric,
    sortUndefined: 'last',
    cell: ({ row }) =>
      row.original.history?.lastSeen
        ? new Date(row.original.history.lastSeen).toLocaleDateString()
        : 'N/A',
  },
  {
    id: 'lastSeen',
    accessorFn: (row) => new Date(row.lastSeen).getTime(),
    header: 'Seen',
    sortFn: sortFn_basic,
  },
]
const columnHelp: Record<string, string> = {
  sessions: 'Anonymous sessions with a heartbeat in the last 65 seconds.',
  actions:
    'Recorded interactions from the last five minutes, limited to 40 retained events per tab.',
  recentViews:
    'Recorded browser page-view events in the last five minutes, from retained tab activity.',
  siteViews:
    'Scarf pixel views for the pixels embedded in tanstack.com, in the selected history window. Not unique people.',
  growth:
    'Pixel-view change against the previous equal-length window. N/A means a comparison was not reported.',
  siteEvents:
    'Events from the dedicated TanStack Site Telemetry package. Includes page views, actions, and server requests. These are not added to pixel views.',
  origins:
    'Scarf unique origins across the selected site pixels. These are sources, not identified people.',
  endpoints:
    'Scarf unique endpoints across the selected site pixels. These are not individual identities.',
}

export function LiveVisitors({
  data,
  paused = false,
}: {
  data: LiveOverview
  paused?: boolean
}) {
  const [expanded, setExpanded] = useState(new Set<string>())
  const [filters, setFilters] = useState(emptyCompanyFilters)
  const [sorting, setSorting] = useState(initialSorting)
  const [pagination, setPagination] = useState(initialPagination)
  const [visibility, setVisibility] = useState(initialVisibility)
  const [selection, setSelection] = useState(initialSelection)
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [comfortable, setComfortable] = useState(false)
  const [showBreakdowns, setShowBreakdowns] = useState(true)
  const [days, setDays] = useState(historyDaysSchema.parse(30))
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const searchInput: { current: HTMLInputElement | null } = useRef(null)
  const history = useQuery({
    queryKey: ['admin', 'scarf-company-history', days],
    queryFn: () => getScarfCompanyHistory({ data: { days } }),
    staleTime: 15 * 60_000,
    refetchInterval: paused ? false : 15 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: !paused,
    retry: false,
  })
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tanstack.live-companies.columns.v1')
      if (saved) {
        const parsed = visibilitySchema.safeParse(JSON.parse(saved))
        if (parsed.success)
          setVisibility({
            ...initialVisibility,
            ...parsed.data,
            unmatched: false,
          })
      }
    } catch {}
    setPreferencesLoaded(true)
  }, [])
  useEffect(() => {
    if (preferencesLoaded)
      try {
        localStorage.setItem(
          'tanstack.live-companies.columns.v1',
          JSON.stringify(visibility),
        )
      } catch {}
  }, [visibility, preferencesLoaded])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !(
          target instanceof HTMLElement &&
          (target.matches('input,textarea,select') || target.isContentEditable)
        )
      ) {
        event.preventDefault()
        searchInput.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const allRows = useMemo(
    () => buildCompanyGridRows(data, history.data),
    [data, history.data],
  )
  const filtered = useMemo(
    () => filterCompanyRows(allRows, filters),
    [allRows, filters],
  )
  const gridRows = useMemo(
    () =>
      selectedOnly
        ? filtered.filter((row) => selection[row.id || 'unmatched'])
        : filtered,
    [filtered, selectedOnly, selection],
  )
  const activeRows = allRows.filter((row) => row.active)
  const activeCount = activeRows.filter((row) => row.id).length
  const summaryRows = gridRows.filter((row) => row.active)
  const selectedRows = allRows.filter((row) => selection[row.id || 'unmatched'])
  const table = useTable({
    features,
    columns,
    data: gridRows,
    getRowId: (row) => row.id || 'unmatched',
    state: {
      sorting,
      pagination,
      columnVisibility: visibility,
      rowSelection: selection,
    },
    onSortingChange: (updater) =>
      setSorting((previous) => [
        { id: 'unmatched', desc: false },
        ...(typeof updater === 'function' ? updater(previous) : updater).filter(
          (sort) => sort.id !== 'unmatched',
        ),
      ]),
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    autoResetPageIndex: false,
  })
  useEffect(() => {
    const lastPage = Math.max(
      0,
      Math.ceil(gridRows.length / pagination.pageSize) - 1,
    )
    if (pagination.pageIndex > lastPage)
      setPagination((previous) => ({ ...previous, pageIndex: lastPage }))
  }, [gridRows.length, pagination.pageSize, pagination.pageIndex])
  useEffect(() => {
    setPagination((previous) =>
      previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 },
    )
  }, [filters])
  const toggleFacet = (facet: CompanyFacet, values: string[]) => {
    setFilters((previous) => ({
      ...previous,
      [facet]: values.every((value) => previous[facet].includes(value))
        ? previous[facet].filter((value) => !values.includes(value))
        : [...new Set([...previous[facet], ...values])],
    }))
    setPagination((previous) => ({ ...previous, pageIndex: 0 }))
  }
  const toggleCompany = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const filterCount =
    facets.reduce((count, facet) => count + filters[facet].length, 0) +
    Number(Boolean(filters.search)) +
    Number(Boolean(filters.minViews)) +
    Number(Boolean(filters.minActions)) +
    Number(filters.identifiedOnly) +
    Number(filters.showRecent)
  const exportRows = () => {
    const records = (
      selectedRows.length
        ? selectedRows
        : table.getPrePaginatedRowModel().rows.map((row) => row.original)
    ).map((row) => ({
      Company: csvSafeText(row.name),
      Domain: csvSafeText(row.id),
      Industry: csvSafeText(row.industry),
      Employees: csvSafeText(row.company?.company_size || ''),
      Libraries: csvSafeText(row.libraries.join(', ')),
      Sessions: row.activeSessions,
      Actions5m: row.actions,
      RecentViews5m: row.recentViews,
      SitePixelViews: row.history?.views ?? '',
      PreviousPixelViews: row.history?.previousViews ?? '',
      Change: csvSafeText(growthLabel(row)),
      SiteEvents: row.history?.siteEvents ?? '',
      Sources: row.history?.origins ?? '',
      Endpoints: row.history?.endpoints ?? '',
      FunnelStage: csvSafeText(row.history?.stage || ''),
      HistoryStart: history.data?.start ?? '',
      HistoryEndExclusive: history.data?.end ?? '',
      LastSeen: new Date(row.lastSeen).toISOString(),
    }))
    const url = URL.createObjectURL(
      new Blob([csvFormat(records)], { type: 'text/csv;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `live-companies-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  const rows = table.getRowModel().rows
  return (
    <div className="flex min-h-0 flex-col gap-2 text-xs xl:h-[calc(100dvh-138px)]">
      {!data.enabled && (
        <p
          role="status"
          className="border border-amber-500/30 bg-amber-500/10 px-3 py-2"
        >
          Collection is off.
        </p>
      )}
      {!data.lookupConfigured && (
        <p role="status" className="text-amber-600">
          Company matching needs the Scarf lookup key.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-gray-500/15 py-2 text-[11px]">
        <div className="flex flex-wrap items-baseline gap-4">
          <span>
            <strong className="font-mono text-base">
              {summaryRows.filter((row) => row.id).length}
            </strong>{' '}
            <span
              className="text-gray-500"
              title={`${activeCount} identified companies online before filters`}
            >
              companies online
            </span>
          </span>
          <span>
            <strong className="font-mono">
              {number.format(
                summaryRows.reduce(
                  (total, row) => total + row.activeSessions,
                  0,
                ),
              )}
            </strong>{' '}
            <span className="text-gray-500">sessions</span>
          </span>
          <span>
            <strong className="font-mono">
              {number.format(
                summaryRows.reduce((total, row) => total + row.actions, 0),
              )}
            </strong>{' '}
            <span className="text-gray-500">actions · 5m</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-expanded={showBreakdowns}
            aria-controls="company-breakdowns"
            onClick={() => setShowBreakdowns((value) => !value)}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {showBreakdowns ? 'Hide breakdowns' : 'Show breakdowns'}
          </button>
          <label className="flex items-center gap-2 text-gray-500">
            Scarf history
            <select
              aria-label="Scarf history window"
              value={days}
              onChange={(event) =>
                setDays(historyDaysSchema.parse(Number(event.target.value)))
              }
              className="h-6 rounded border border-gray-500/20 bg-transparent px-1 text-gray-900 dark:text-gray-100"
            >
              {[7, 30, 90, 365].map((day) => (
                <option key={day} value={day}>
                  {day} days
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {showBreakdowns && (
        <div
          id="company-breakdowns"
          className="grid divide-y divide-gray-500/15 border border-gray-500/20 md:grid-cols-3 md:divide-x md:divide-y-0 rounded-md"
        >
          {widgetFacets.map((facet) => (
            <CompanyBreakdownChart
              key={facet}
              title={
                facet === 'library'
                  ? 'Libraries'
                  : facet === 'size'
                    ? 'Company size'
                    : 'Industries'
              }
              items={companyWidgetItems(
                companyFacetCounts(
                  filterCompanyRows(allRows, filters, facet),
                  facet,
                ),
              )}
              color={
                facet === 'library'
                  ? '#6366f1'
                  : facet === 'size'
                    ? '#10b981'
                    : '#0ea5e9'
              }
              selected={filters[facet]}
              onSelect={(values) => toggleFacet(facet, values)}
              note={
                facet === 'size'
                  ? "Grouped by the lower bound of Scarf's reported employee range."
                  : facet === 'library'
                    ? 'A company can appear in multiple libraries. Other combines the remaining category counts.'
                    : undefined
              }
            />
          ))}
        </div>
      )}
      <div className="flex min-h-6 flex-wrap items-center gap-2 text-[10px] text-gray-500">
        {history.isFetching ? (
          <span>Loading Scarf history...</span>
        ) : history.isError ? (
          <>
            <span className="text-amber-600">
              Scarf history could not load.
            </span>
            <button
              type="button"
              className="underline"
              onClick={() => history.refetch()}
            >
              Retry
            </button>
          </>
        ) : history.data?.status === 'unconfigured' ? (
          <span className="text-amber-600">
            Scarf reporting token is not configured.
          </span>
        ) : history.data?.status === 'unavailable' ? (
          <>
            <span
              className="text-amber-600"
              title={history.data.issues.join(' ')}
            >
              Scarf history unavailable. Live activity is still updating.
            </span>
            <button
              type="button"
              className="underline"
              onClick={() => history.refetch()}
            >
              Retry
            </button>
          </>
        ) : (
          history.data && (
            <>
              <span
                title={`${history.data.start} through ${history.data.end} exclusive, UTC. Refreshes every 15 minutes.`}
              >
                Scarf synced{' '}
                {new Date(history.data.fetchedAt).toLocaleTimeString()}
              </span>
              {history.data.status === 'partial' && (
                <span
                  className="text-amber-600"
                  title={history.data.issues.join(' ')}
                >
                  Some metrics unavailable
                </span>
              )}
              <span>
                Pixel views and site events are separate measurements.
              </span>
            </>
          )
        )}
      </div>
      <section
        className="flex min-h-0 flex-1 flex-col rounded-md border border-gray-500/20"
        aria-label="Company prioritization grid"
      >
        <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-500/15 p-2">
          <div className="relative mr-1">
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-2 text-gray-500"
            />
            <input
              ref={searchInput}
              aria-label="Search companies or pages"
              placeholder="Search companies or pages /"
              value={filters.search}
              onChange={(event) => {
                setFilters((previous) => ({
                  ...previous,
                  search: event.target.value,
                }))
                setPagination((previous) => ({ ...previous, pageIndex: 0 }))
              }}
              className="h-7 w-56 rounded border border-gray-500/20 bg-transparent pl-7 pr-2 text-[11px] outline-none focus:border-emerald-500"
            />
          </div>
          {facets.map((facet) => (
            <CompanyFacetFilter
              key={facet}
              label={facetLabels[facet]}
              items={companyFacetCounts(
                filterCompanyRows(allRows, filters, facet),
                facet,
                !filters.showRecent,
              )}
              selected={filters[facet]}
              onToggle={(values) => toggleFacet(facet, values)}
            />
          ))}
          <label className="flex h-7 items-center gap-1 rounded border border-gray-500/20 px-2 text-[10px] text-gray-500">
            <span>Views ≥</span>
            <input
              aria-label="Minimum historical site views"
              type="number"
              min={0}
              placeholder="0"
              value={filters.minViews}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  minViews: event.target.value,
                }))
              }
              className="w-12 bg-transparent text-[11px] outline-none"
            />
          </label>
          <label className="flex h-7 items-center gap-1 rounded border border-gray-500/20 px-2 text-[10px] text-gray-500">
            <span>Actions ≥</span>
            <input
              aria-label="Minimum recent actions"
              type="number"
              min={0}
              placeholder="0"
              value={filters.minActions}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  minActions: event.target.value,
                }))
              }
              className="w-12 bg-transparent text-[11px] outline-none"
            />
          </label>
          <div className="ml-auto flex items-center gap-1.5">
            <select
              aria-label="Sort preset"
              value={
                sorting[1]?.id === 'siteViews' && sorting[1]?.desc
                  ? 'views'
                  : sorting[1]?.id === 'actions' && sorting[1]?.desc
                    ? 'activity'
                    : sorting[1]?.id === 'size' && sorting[1]?.desc
                      ? 'size'
                      : 'custom'
              }
              onChange={(event) =>
                setSorting([
                  { id: 'unmatched', desc: false },
                  ...(event.target.value === 'activity'
                    ? [
                        { id: 'actions', desc: true },
                        { id: 'sessions', desc: true },
                      ]
                    : event.target.value === 'size'
                      ? [
                          { id: 'size', desc: true },
                          { id: 'siteViews', desc: true },
                        ]
                      : [
                          { id: 'siteViews', desc: true },
                          { id: 'actions', desc: true },
                        ]),
                ])
              }
              className="h-7 rounded border border-gray-500/20 bg-transparent px-1 text-[11px]"
            >
              <option value="custom" disabled>
                Custom sort
              </option>
              <option value="views">Most site views</option>
              <option value="activity">Most active now</option>
              <option value="size">Largest companies</option>
            </select>
            <details className="relative">
              <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded border border-gray-500/20 px-2 text-[11px] [&::-webkit-details-marker]:hidden">
                <ColumnsIcon aria-hidden="true" />
                Columns
              </summary>
              <fieldset className="absolute right-0 top-8 z-40 max-h-80 w-48 overflow-auto rounded border border-gray-500/25 bg-white p-1 shadow-lg dark:bg-gray-950">
                <legend className="sr-only">Visible columns</legend>
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <label
                      key={column.id}
                      className="flex cursor-pointer items-center gap-2 px-2 py-1 text-[11px] hover:bg-gray-500/10"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={(event) =>
                          column.toggleVisibility(event.target.checked)
                        }
                        className="accent-emerald-600"
                      />
                      {String(column.columnDef.header)}
                    </label>
                  ))}
              </fieldset>
            </details>
            <select
              aria-label="Row density"
              value={comfortable ? 'comfortable' : 'compact'}
              onChange={(event) =>
                setComfortable(event.target.value === 'comfortable')
              }
              className="h-7 rounded border border-gray-500/20 bg-transparent px-1 text-[11px]"
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
            </select>
            <button
              type="button"
              onClick={exportRows}
              className="flex h-7 items-center gap-1 rounded border border-gray-500/20 px-2 text-[11px]"
              disabled={
                (selectedOnly && !selectedRows.length) ||
                (!filtered.length && !selectedRows.length)
              }
            >
              <DownloadSimpleIcon aria-hidden="true" />
              Export
              {selectedRows.length ? ` ${selectedRows.length} selected` : ''}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-500/15 px-2 py-1.5 text-[10px] text-gray-500">
          <span className="font-mono">
            {filtered.filter((row) => row.id).length} /{' '}
            {
              allRows.filter(
                (row) => row.id && (filters.showRecent || row.active),
              ).length
            }{' '}
            companies
          </span>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={filters.identifiedOnly}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  identifiedOnly: event.target.checked,
                }))
              }
              className="accent-emerald-600"
            />
            Identified only
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={filters.showRecent}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  showRecent: event.target.checked,
                }))
              }
              className="accent-emerald-600"
            />
            Include recently left
          </label>
          {(selectedRows.length > 0 || selectedOnly) && (
            <>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={selectedOnly}
                  onChange={(event) => setSelectedOnly(event.target.checked)}
                />
                Selected only ({selectedRows.length})
              </label>
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setSelection({})
                  setSelectedOnly(false)
                }}
              >
                Clear selection
              </button>
            </>
          )}
          {filterCount > 0 && (
            <button
              type="button"
              className="ml-auto underline"
              onClick={() => {
                setFilters(emptyCompanyFilters)
                setSelectedOnly(false)
                setPagination(initialPagination)
              }}
            >
              Clear filters ({filterCount})
            </button>
          )}
        </div>
        {facets.some((facet) => filters[facet].length > 0) && (
          <div className="flex flex-wrap gap-1 border-b border-gray-500/15 px-2 py-1.5">
            {facets.flatMap((facet) =>
              filters[facet].map((value) => (
                <button
                  key={`${facet}-${value}`}
                  type="button"
                  onClick={() => toggleFacet(facet, [value])}
                  className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400"
                  aria-label={`Remove ${facetLabels[facet]} filter ${value}`}
                >
                  {facetLabels[facet]}: {value}
                  <XIcon aria-hidden="true" />
                </button>
              )),
            )}
          </div>
        )}
        <div className="min-h-48 flex-1 overflow-auto">
          <table
            className="w-full border-collapse whitespace-nowrap text-left text-[11px]"
            aria-label="Live companies"
          >
            <thead className="sticky top-0 z-20 bg-gray-50 text-[10px] text-gray-500 dark:bg-gray-950">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const sort = header.column.getIsSorted()
                    const index = sorting.findIndex(
                      (item) => item.id === header.column.id,
                    )
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        title={
                          columnHelp[header.column.id] ||
                          'Click to sort. Shift-click to add another sort.'
                        }
                        aria-sort={
                          sort === 'asc'
                            ? 'ascending'
                            : sort === 'desc'
                              ? 'descending'
                              : undefined
                        }
                        className={`border-b border-gray-500/20 px-2 py-2 font-medium ${header.column.id === 'name' ? 'sticky left-8 z-30 min-w-64 bg-gray-50 dark:bg-gray-950' : header.column.id === 'select' ? 'sticky left-0 z-30 w-8 bg-gray-50 dark:bg-gray-950' : ''}`}
                      >
                        {header.column.id === 'select' ? (
                          <input
                            type="checkbox"
                            aria-label="Select companies on this page"
                            checked={table.getIsAllPageRowsSelected()}
                            ref={(element) => {
                              if (element)
                                element.indeterminate =
                                  table.getIsSomePageRowsSelected()
                            }}
                            onChange={(event) =>
                              table.toggleAllPageRowsSelected(
                                event.target.checked,
                              )
                            }
                            className="accent-emerald-600"
                          />
                        ) : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="flex items-center gap-1.5 focus-visible:outline focus-visible:outline-emerald-500"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <table.FlexRender header={header} />
                            {sort ? (
                              <span
                                className="font-mono text-gray-400"
                                aria-hidden="true"
                              >
                                {sort === 'asc' ? '↑' : '↓'}
                                {sorting.length > 2 ? index : ''}
                              </span>
                            ) : (
                              <ArrowsDownUpIcon
                                aria-hidden="true"
                                className="opacity-30"
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
                      className={`${row.getIsSelected() ? 'bg-emerald-500/10' : 'bg-white dark:bg-gray-950'} hover:bg-gray-50 dark:hover:bg-gray-900`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`${comfortable ? 'py-2.5' : 'py-1.5'} px-2 ${cell.column.id === 'name' ? 'sticky left-8 z-10 max-w-80 bg-inherit' : cell.column.id === 'select' ? 'sticky left-0 z-10 bg-inherit' : cell.column.id === 'industry' || cell.column.id === 'libraries' || cell.column.id === 'stage' ? 'text-gray-500' : 'font-mono tabular-nums'}`}
                        >
                          {cell.column.id === 'select' ? (
                            <input
                              type="checkbox"
                              aria-label={`Select ${company.name}`}
                              checked={row.getIsSelected()}
                              onChange={(event) =>
                                row.toggleSelected(event.target.checked)
                              }
                              className="accent-emerald-600"
                            />
                          ) : cell.column.id === 'name' ? (
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-controls={`company-${row.id}`}
                              onClick={() => toggleCompany(row.id)}
                              className="flex w-full items-center gap-2 text-left focus-visible:outline focus-visible:outline-emerald-500"
                            >
                              {open ? (
                                <CaretDownIcon
                                  aria-hidden="true"
                                  className="shrink-0 text-gray-500"
                                />
                              ) : (
                                <CaretRightIcon
                                  aria-hidden="true"
                                  className="shrink-0 text-gray-500"
                                />
                              )}
                              <span
                                className={`size-1.5 shrink-0 rounded-full ${company.active ? 'bg-emerald-500' : 'bg-gray-400'}`}
                                aria-hidden="true"
                              />
                              <span
                                className="min-w-0 truncate font-sans font-medium"
                                title={`${company.name}${company.id ? ` · ${company.id}` : ''}`}
                              >
                                {company.name}
                              </span>
                            </button>
                          ) : cell.column.id === 'lastSeen' ? (
                            <span
                              title={new Date(
                                company.lastSeen,
                              ).toLocaleString()}
                              className="text-gray-500"
                            >
                              {age(company.lastSeen, data.now)}
                            </span>
                          ) : (
                            <table.FlexRender cell={cell} />
                          )}
                        </td>
                      ))}
                    </tr>
                    {open && (
                      <tr>
                        <td
                          colSpan={table.getVisibleLeafColumns().length}
                          className="whitespace-normal border-y border-emerald-500/20 bg-gray-500/[0.035] p-2"
                        >
                          <div
                            id={`company-${row.id}`}
                            className="rounded border border-gray-500/15"
                          >
                            <div className="flex flex-wrap items-center gap-3 border-b border-gray-500/15 px-3 py-2 text-[11px]">
                              <strong>{company.name}</strong>
                              {company.id && (
                                <a
                                  href={`https://${company.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-gray-500 underline"
                                >
                                  {company.id}
                                </a>
                              )}
                              <span className="text-gray-500">
                                {company.activeSessions} active sessions ·{' '}
                                {company.activeTabs} tabs
                              </span>
                              {company.company?.linkedin_url &&
                                /^https:\/\/(www\.)?linkedin\.com\//.test(
                                  company.company.linkedin_url,
                                ) && (
                                  <a
                                    href={company.company.linkedin_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ml-auto underline"
                                  >
                                    LinkedIn
                                  </a>
                                )}
                            </div>
                            <LiveCompanySessions
                              domain={company.id}
                              paused={paused}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={table.getVisibleLeafColumns().length}
                    className="py-12 text-center text-xs text-gray-500"
                  >
                    {filterCount || selectedOnly
                      ? 'No companies match these filters.'
                      : 'No companies on public pages right now.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-500/15 px-2 py-1.5 text-[10px] text-gray-500">
          <span>Network matches, not verified employers.</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              Rows
              <select
                aria-label="Rows per page"
                value={pagination.pageSize}
                onChange={(event) =>
                  table.setPageSize(Number(event.target.value))
                }
                className="rounded border border-gray-500/20 bg-transparent px-1"
              >
                {[25, 50, 100, 250].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              className="px-1 disabled:opacity-30"
            >
              Previous
            </button>
            <span className="font-mono">
              {Math.min(
                pagination.pageIndex + 1,
                Math.max(1, table.getPageCount()),
              )}{' '}
              / {Math.max(1, table.getPageCount())}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              className="px-1 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
