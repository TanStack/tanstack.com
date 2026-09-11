import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { getRouteApi } from '@tanstack/react-router'
import {
  ArrowLeftIcon,
  ChartBarIcon,
  ClockIcon,
  TableIcon,
  MapPinIcon,
  ArrowUpRightIcon,
} from '@phosphor-icons/react'
import { Resizable } from '~/components/npm-stats/Resizable'
import { createSnapshotCollections, snapshotOptions } from './data'
import {
  dashboardSearch,
  dollars,
  exploreTrips,
  type DashboardSearch,
  type Snapshot,
  type RecordRow,
} from './model'
import { NativeSkin, type DashboardUI } from './ui'
import { TripTrend, HourChart, DurationChart } from './Charts'
import { TripTable, useTripGrid } from './TripTable'
import './dashboard.css'
import { dashboardOptions } from './query-options'
import type { DashboardResult } from './server/queries'
import { serverRequestSchema, matchesGrid, type GridSelection } from './request'

const emptyRows: RecordRow[] = []
const emptySelection: GridSelection = { all: false, ids: [] }
const Route = getRouteApi('/examples/dashboard')
const MaterialSkin = lazy(() => import('./MaterialSkin'))
const ShadcnSkin = lazy(() => import('./ShadcnSkin'))
const boroughs = [
  'All',
  'Bronx',
  'Brooklyn',
  'Manhattan',
  'Queens',
  'Staten Island',
  'Unknown',
  'N/A',
]
export default function Dashboard() {
  const search = Route.useSearch()
  return search.source === 'server' ? <ServerDashboard /> : <ClientDashboard />
}
function ClientDashboard() {
  const query = useQuery(snapshotOptions)
  if (query.data)
    return (
      <SnapshotDashboard
        snapshot={query.data}
        error={query.error?.message}
        retry={() => void query.refetch()}
        paused={query.isPaused}
      />
    )
  if (query.isError)
    return (
      <div role="alert" className="p-8">
        <p>{query.error.message}</p>
        <button onClick={() => void query.refetch()}>Retry</button>
      </div>
    )
  return (
    <p role="status" className="p-8">
      {query.isPaused
        ? 'Offline. Waiting for a connection…'
        : 'Loading taxi records…'}
    </p>
  )
}
function SnapshotDashboard({
  snapshot,
  error,
  retry,
  paused,
}: {
  snapshot: Snapshot
  error?: string
  retry: () => void
  paused: boolean
}) {
  const [collections, setCollections] = useState(
    (): ReturnType<typeof createSnapshotCollections> | undefined => undefined,
  )
  useEffect(() => {
    const created = createSnapshotCollections(snapshot)
    setCollections(created)
    return () => {
      void created.trips.cleanup()
      void created.zones.cleanup()
    }
  }, [snapshot])
  return collections ? (
    <Explorer
      collections={collections}
      snapshot={snapshot}
      error={error}
      retry={retry}
      paused={paused}
    />
  ) : (
    <p role="status" className="p-8">
      Preparing local records…
    </p>
  )
}
function Explorer({
  collections,
  snapshot,
  error,
  retry,
  paused,
}: {
  error?: string
  retry: () => void
  paused: boolean
  collections: ReturnType<typeof createSnapshotCollections>
  snapshot: Snapshot
}) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: joined, isLoading } = useLiveQuery({
    query: (q) => {
      const base = q
        .from({ trip: collections.trips })
        .innerJoin({ zone: collections.zones }, ({ trip, zone }) =>
          eq(trip.zoneId, zone.id),
        )
      const filtered =
        search.borough === 'All'
          ? base
          : base.where(({ zone }) => eq(zone.borough, search.borough))
      return filtered
        .orderBy(({ trip }) => trip.pickup)
        .orderBy(({ trip }) => trip.id)
        .select(({ trip, zone }) => ({
          ...trip,
          zone: zone.name,
          borough: zone.borough,
        }))
    },
  })
  const analysis = useMemo(() => {
    const start = performance.now()
    const result = exploreTrips(
      joined.filter((row) => matchesGrid(row, search.grid)),
      search.day,
      search.zone,
    )
    performance.measure('dashboard:derive', { start, end: performance.now() })
    return result
  }, [joined, search.day, search.zone, search.grid])
  const grid = useTripGrid(analysis.rows, undefined, {
    state: search.grid,
    onChange: (grid) => {
      void navigate({
        search: (previous) => ({ ...previous, grid }),
        resetScroll: false,
        replace: true,
      })
    },
  })
  const selected = snapshot.trips.find((row) => row.id === search.selected)
  const selectedZone = snapshot.zones.find((zone) => zone.id === search.zone)
  return (
    <DashboardView
      analysis={analysis}
      grid={grid}
      selected={selected}
      selectedZone={selectedZone}
      zones={snapshot.zones}
      snapshotCount={snapshot.trips.length}
      selectedMatches={analysis.rows.some((row) => row.id === search.selected)}
      isLoading={isLoading}
      error={error}
      retry={retry}
      paused={paused}
    />
  )
}
function ServerDashboard() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const scopeKey = JSON.stringify([
    search.day,
    search.zone,
    search.borough,
    search.grid.query,
    search.grid.filters,
  ])
  const [scopedSelection, setScopedSelection] = useState(() => ({
    scopeKey,
    value: emptySelection,
  }))
  useEffect(() => {
    setScopedSelection((previous) =>
      previous.scopeKey === scopeKey
        ? previous
        : { scopeKey, value: emptySelection },
    )
  }, [scopeKey])
  const selection =
    scopedSelection.scopeKey === scopeKey
      ? scopedSelection.value
      : emptySelection
  const setSelection = (value: GridSelection) =>
    setScopedSelection({ scopeKey, value })
  const input = serverRequestSchema.parse({
    day: search.day,
    zone: search.zone,
    borough: search.borough,
    grid: search.grid,
    selected: search.selected,
    selection,
  })
  const filterKey = JSON.stringify({
    query: search.grid.query,
    filters: search.grid.filters,
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filterKey)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filterKey), 200)
    return () => clearTimeout(timer)
  }, [filterKey])
  const request = serverRequestSchema.parse({
    ...input,
    grid: { ...input.grid, ...JSON.parse(debouncedFilters) },
  })
  const requestKey = JSON.stringify(input)
  const query = useQuery({
    ...dashboardOptions(request),
    placeholderData: keepPreviousData,
  })
  const lagging = filterKey !== debouncedFilters
  const busy = query.isFetching || lagging
  useEffect(() => {
    if (
      query.data &&
      !query.isPlaceholderData &&
      requestKey === JSON.stringify(request) &&
      search.grid.page !== query.data.page
    ) {
      const page = query.data.page
      void navigate({
        search: (previous) => ({
          ...previous,
          grid: { ...previous.grid, page },
        }),
        resetScroll: false,
        replace: true,
      })
    }
  }, [
    query.data,
    query.isPlaceholderData,
    requestKey,
    request,
    search.grid.page,
    navigate,
  ])
  const remote = {
    state: search.grid,
    onChange: (grid: DashboardSearch['grid']) => {
      void navigate({
        search: (previous) => ({ ...previous, grid }),
        resetScroll: false,
        replace:
          grid.query !== search.grid.query ||
          JSON.stringify(grid.filters) !== JSON.stringify(search.grid.filters),
      })
    },
    result: query.data,
    busy: lagging || query.isPlaceholderData || !query.data,
    selection,
    setSelection,
    exportCsv: async (selected: boolean) => {
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = '/api/dashboard-export'
      form.target = '_blank'
      form.rel = 'noopener'
      const field = document.createElement('input')
      field.type = 'hidden'
      field.name = 'payload'
      field.value = JSON.stringify({ request: input, selected })
      form.append(field)
      document.body.append(form)
      form.submit()
      form.remove()
    },
  }
  const grid = useTripGrid(query.data?.rows ?? emptyRows, remote)
  if (!query.data)
    return (
      <div className="p-8" role={query.isError ? 'alert' : 'status'}>
        {query.isError ? (
          <>
            <p>{query.error.message}</p>
            <button onClick={() => void query.refetch()}>Retry</button>
            <button
              onClick={() =>
                void navigate({
                  search: (previous) => ({ ...previous, source: 'client' }),
                })
              }
            >
              Use client mode
            </button>
          </>
        ) : query.isPaused ? (
          'Offline. Waiting for a connection…'
        ) : (
          'Loading dashboard from the server…'
        )}
      </div>
    )
  return (
    <DashboardView
      analysis={query.data.analysis}
      grid={grid}
      selected={query.data.selected}
      selectedZone={query.data.allZones.find((zone) => zone.id === search.zone)}
      zones={query.data.allZones}
      snapshotCount={query.data.snapshotCount}
      selectedMatches={query.data.selectedMatches}
      isLoading={busy}
      paused={query.isPaused}
      error={query.error?.message}
      retry={() => void query.refetch()}
    />
  )
}
function DashboardView({
  analysis,
  grid,
  selected,
  selectedZone,
  zones,
  snapshotCount,
  selectedMatches,
  isLoading,
  error,
  retry,
  paused,
}: {
  analysis: DashboardResult['analysis']
  grid: ReturnType<typeof useTripGrid>
  selected: Snapshot['trips'][number] | undefined
  selectedZone: Snapshot['zones'][number] | undefined
  zones: Snapshot['zones']
  snapshotCount: number
  selectedMatches: boolean
  isLoading: boolean
  error?: string
  retry?: () => void
  paused?: boolean
}) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const update = (patch: Partial<DashboardSearch>) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...patch,
        grid:
          patch.day !== undefined ||
          patch.zone !== undefined ||
          patch.borough !== undefined ||
          patch.source !== undefined
            ? { ...previous.grid, page: 0 }
            : previous.grid,
      }),
      resetScroll: false,
    })
  }
  const [height, setHeight] = useState(190)
  const Skin = {
    native: NativeSkin,
    material: MaterialSkin,
    shadcn: ShadcnSkin,
  }[search.kit]
  const dark = search.appearance === 'dark'
  const filterDay = (day: number) =>
    update({ day: search.day === day ? 0 : day })
  const filtered =
    search.day !== 0 || search.zone !== 0 || search.borough !== 'All'
  function content(ui: DashboardUI) {
    return (
      <>
        <aside className="dash-sidebar">
          <a href="/" className="dash-brand">
            <span className="dash-brand-mark">T</span> TanStack{' '}
            <span className="dash-brand-tag">/ examples</span>
          </a>
          <div className="dash-workspace">
            <span className="dash-taxi">NY</span>
            <div>
              Taxi mobility<small>New York City</small>
            </div>
          </div>
          <nav aria-label="Dashboard sections">
            <a href="#overview">
              <ChartBarIcon size={18} />
              Overview
            </a>
            <a href="#patterns">
              <ClockIcon size={18} />
              Trip patterns
            </a>
            <a href="#records">
              <TableIcon size={18} />
              Trip records
            </a>
          </nav>
          <div className="dash-sidebar-bottom">
            <ui.Select
              label="Data source"
              value={search.source}
              onChange={(value) =>
                update({ source: dashboardSearch.shape.source.parse(value) })
              }
              options={[
                { value: 'server', label: 'Server' },
                { value: 'client', label: 'Client' },
              ]}
            />
            <ui.Select
              label="Components"
              value={search.kit}
              onChange={(value) =>
                update({ kit: dashboardSearch.shape.kit.parse(value) })
              }
              options={[
                { value: 'native', label: 'Custom' },
                { value: 'material', label: 'Material UI' },
                { value: 'shadcn', label: 'shadcn / Base UI' },
              ]}
            />
            <ui.Select
              label="Appearance"
              value={search.appearance}
              onChange={(value) =>
                update({
                  appearance: dashboardSearch.shape.appearance.parse(value),
                })
              }
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <a href="/" className="dash-back">
              <ArrowLeftIcon size={14} /> Back to TanStack
            </a>
          </div>
        </aside>
        <div className="dash-main">
          <header className="dash-topbar">
            <span>
              Examples <span className="dash-slash">/</span> Taxi mobility
            </span>
            <a
              href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page"
              target="_blank"
              rel="noreferrer"
            >
              NYC TLC data <ArrowUpRightIcon size={14} />
            </a>
          </header>
          <div className="dash-content">
            {paused && (
              <p role="status">
                Offline. Showing cached results until the connection returns.
              </p>
            )}
            {error && (
              <div role="alert">
                {error} <button onClick={retry}>Retry</button>
              </div>
            )}
            <div role="status" aria-live="polite" aria-atomic="true">
              {isLoading && !paused && (
                <>
                  <div className="dash-query-progress" aria-hidden="true" />
                  <p className="dash-updating">Updating data…</p>
                </>
              )}
            </div>
            <section id="overview" aria-label="Overview">
              <div className="dash-title">
                <div>
                  <h1>Taxi mobility</h1>
                  <p>Green taxi trips across New York City</p>
                </div>
                <a
                  className="dash-download"
                  href="/data/dashboard/green-2025-week1.v1.json"
                  download
                >
                  Download data <ArrowUpRightIcon size={14} />
                </a>
              </div>
              <div className="dash-toolbar">
                <ui.Select
                  label="Pickup day"
                  value={String(search.day)}
                  onChange={(value) => update({ day: Number(value) })}
                  options={[
                    { value: '0', label: 'Jan 1–7, 2025' },
                    ...analysis.days.map((day) => ({
                      value: String(day.day),
                      label: `Jan ${day.day}, 2025`,
                    })),
                  ]}
                />
                <ui.Select
                  label="Pickup borough"
                  value={search.borough}
                  onChange={(value) =>
                    update({
                      borough: dashboardSearch.shape.borough.parse(value),
                      zone: 0,
                    })
                  }
                  options={boroughs.map((borough) => ({
                    value: borough,
                    label: borough === 'All' ? 'All boroughs' : borough,
                  }))}
                />
                {search.zone !== 0 && (
                  <ui.Button
                    className="dash-filter-chip"
                    onClick={() => update({ zone: 0 })}
                  >
                    {selectedZone?.name ?? 'Unknown zone'} ×
                  </ui.Button>
                )}
                {filtered && (
                  <ui.Button
                    onClick={() => update({ day: 0, borough: 'All', zone: 0 })}
                  >
                    Clear filters
                  </ui.Button>
                )}
                <span className="dash-timezone">NYC local time</span>
              </div>
              <div
                className="dash-metrics"
                aria-live="polite"
                aria-busy={isLoading}
              >
                <ui.Panel>
                  <span>Trips</span>
                  <strong data-testid="trip-count">
                    {analysis.summary.count.toLocaleString()}
                  </strong>
                  <small>
                    {filtered
                      ? `${((analysis.summary.count / snapshotCount) * 100).toFixed(1)}% of the snapshot`
                      : 'January 1–7, 2025'}
                  </small>
                </ui.Panel>
                <ui.Panel>
                  <span>Base fares</span>
                  <strong data-testid="fare-total">
                    {dollars(analysis.summary.fareCents)}
                  </strong>
                  <small>Excludes tips, taxes, and fees</small>
                </ui.Panel>
                <ui.Panel>
                  <span>Median duration</span>
                  <strong>
                    {analysis.summary.count
                      ? analysis.medianMinutes.toFixed(1)
                      : 'N/A'}{' '}
                    <em>min</em>
                  </strong>
                  <small>Half of trips were shorter</small>
                </ui.Panel>
                <ui.Panel>
                  <span>Average distance</span>
                  <strong>
                    {analysis.summary.count
                      ? analysis.averageMiles.toFixed(2)
                      : 'N/A'}{' '}
                    <em>mi</em>
                  </strong>
                  <small>Reported trip distance</small>
                </ui.Panel>
              </div>
            </section>
            <div className="dash-analysis-grid">
              <ui.Panel className="dash-trend">
                <div className="dash-panel-heading">
                  <div>
                    <h2>Trip volume</h2>
                    <p>Hourly pickups · select a day to explore</p>
                  </div>
                  <label className="dash-resize">
                    Height
                    <input
                      aria-label="Chart height"
                      type="range"
                      min={160}
                      max={320}
                      step={10}
                      value={height}
                      onChange={(event) =>
                        setHeight(Number(event.target.value))
                      }
                    />
                  </label>
                </div>
                <Resizable
                  height={height}
                  minHeight={160}
                  enableWidthResize={false}
                  onSizeChange={(size) => {
                    if (size.height !== undefined) setHeight(size.height)
                  }}
                >
                  <TripTrend
                    data={analysis.timeline}
                    height={height}
                    dark={dark}
                    onDay={filterDay}
                  />
                </Resizable>
                <div className="dash-days">
                  {analysis.days.map((day) => (
                    <ui.Button
                      key={day.day}
                      aria-pressed={search.day === day.day}
                      aria-label={`Filter January ${day.day}, ${day.count} trips`}
                      onClick={() => filterDay(day.day)}
                    >
                      <span>Jan {day.day}</span>
                      <strong>{day.count.toLocaleString()}</strong>
                    </ui.Button>
                  ))}
                </div>
              </ui.Panel>
              <ui.Panel className="dash-zones">
                <div className="dash-panel-heading">
                  <div>
                    <h2>Pickup zones</h2>
                    <p>{analysis.zones.length} zones · ranked by trips</p>
                  </div>
                  <MapPinIcon size={19} />
                </div>
                <div className="dash-rank-head">
                  <span>Zone</span>
                  <span>Trips</span>
                </div>
                <div className="dash-rank-list">
                  {analysis.zones.slice(0, 10).map((zone, index) => (
                    <ui.Button
                      key={zone.id}
                      className="dash-rank"
                      aria-label={`Filter zone ${zone.name}`}
                      aria-pressed={search.zone === zone.id}
                      onClick={() =>
                        update({ zone: search.zone === zone.id ? 0 : zone.id })
                      }
                    >
                      <span className="dash-rank-number">{index + 1}</span>
                      <span className="dash-rank-body">
                        <span>{zone.name}</span>
                        <span className="dash-rank-track">
                          <span
                            style={{
                              width: `${(zone.count / (analysis.zones[0]?.count ?? 1)) * 100}%`,
                            }}
                          />
                        </span>
                      </span>
                      <strong>{zone.count.toLocaleString()}</strong>
                    </ui.Button>
                  ))}
                </div>
                {!analysis.zones.length && (
                  <p className="dash-empty">No pickup zones match.</p>
                )}
                <p className="dash-zone-note">
                  Top 10 shown. Select a zone to filter all charts.
                </p>
              </ui.Panel>
              <ui.Panel id="patterns" className="dash-hours">
                <div className="dash-panel-heading">
                  <div>
                    <h2>Time of day</h2>
                    <p>Trips by pickup hour</p>
                  </div>
                  <ClockIcon size={18} />
                </div>
                <HourChart data={analysis.hours} dark={dark} />
              </ui.Panel>
              <ui.Panel className="dash-duration">
                <div className="dash-panel-heading">
                  <div>
                    <h2>Trip duration</h2>
                    <p>Trips by duration, in minutes</p>
                  </div>
                </div>
                <DurationChart data={analysis.durations} dark={dark} />
              </ui.Panel>
            </div>
            <ui.Panel id="records" className="dash-record-panel">
              <div className="dash-panel-heading">
                <div className="dash-record-title">
                  <h2>Trip records</h2>
                  <span className="dash-count">
                    {analysis.summary.count.toLocaleString()}
                  </span>
                </div>
                <span className="dash-record-hint">
                  Click a trip ID to inspect
                </span>
              </div>
              <div
                className={`dash-record-layout ${selected ? 'has-selection' : ''}`}
              >
                <TripTable
                  ui={ui}
                  controller={grid}
                  rows={grid.table.options.data}
                  selected={search.selected}
                  onSelect={(id) =>
                    update({ selected: search.selected === id ? 0 : id })
                  }
                />
                {selected && (
                  <aside
                    className="dash-trip-detail"
                    aria-label={`Details for trip ${selected.id}`}
                  >
                    <div className="dash-detail-heading">
                      <h3>Trip #{selected.id}</h3>
                      <ui.Button
                        aria-label="Close trip details"
                        onClick={() => update({ selected: 0 })}
                      >
                        ×
                      </ui.Button>
                    </div>
                    <dl>
                      <dt>Pickup</dt>
                      <dd>
                        {
                          zones.find((zone) => zone.id === selected.zoneId)
                            ?.name
                        }
                      </dd>
                      <dt>Drop-off</dt>
                      <dd>
                        {zones.find(
                          (zone) => zone.id === selected.dropoffZoneId,
                        )?.name ?? 'Unknown zone'}
                      </dd>
                      <dt>NYC local time</dt>
                      <dd>
                        Jan {selected.day}, {selected.pickup.slice(11)}
                      </dd>
                      <dt>Duration / distance</dt>
                      <dd>
                        {selected.minutes.toFixed(1)} min /{' '}
                        {selected.miles.toFixed(2)} mi
                      </dd>
                      <dt>Base fare</dt>
                      <dd>{dollars(selected.fareCents)}</dd>
                    </dl>
                    {!selectedMatches && (
                      <p>This trip is outside the current filters.</p>
                    )}
                  </aside>
                )}
              </div>
            </ui.Panel>
            <footer className="dash-provenance">
              <span>
                Source:{' '}
                <a href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page">
                  NYC Taxi & Limousine Commission
                </a>
              </span>
              <details>
                <summary>About this snapshot</summary>
                <p>
                  8,936 green taxi trips, January 1–7, 2025. Duration (0, 180]
                  minutes, distance (0, 100] miles, base fare ($0, $500]. No
                  sampling or deduplication. Base fare is not driver income. TLC
                  does not guarantee accuracy. Duration bins include their lower
                  bound; the final bin includes 180 minutes.
                </p>
                <a href="/data/dashboard/manifest.json">
                  Source hashes and reference totals
                </a>
              </details>
            </footer>
          </div>
        </div>
      </>
    )
  }
  return (
    <main
      className="dashboard"
      data-appearance={search.appearance}
      data-kit={search.kit}
    >
      <Suspense
        fallback={
          <p role="status" className="p-8">
            Loading components…
          </p>
        }
      >
        <Skin appearance={search.appearance}>{content}</Skin>
      </Suspense>
    </main>
  )
}
