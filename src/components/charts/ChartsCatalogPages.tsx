import { Link } from '@tanstack/react-router'
import * as React from 'react'
import type { ChartsCatalogCase } from '~/utils/charts-catalog'
import {
  ChartsCatalogChart,
  type ChartsCatalogModuleReference,
} from './ChartsCatalogChart'

type CatalogCaseMetadata = Pick<
  ChartsCatalogCase,
  | 'ai'
  | 'family'
  | 'features'
  | 'geometry'
  | 'id'
  | 'intent'
  | 'order'
  | 'referenceRenderer'
  | 'routes'
  | 'schemaVersion'
  | 'source'
  | 'support'
  | 'title'
>

type CatalogCaseModules = {
  tanstack: ChartsCatalogModuleReference
  comparison?: ChartsCatalogModuleReference & {
    renderer: 'observable-plot' | 'recharts' | 'echarts'
    visibility: 'debug'
  }
}

export function ChartsCatalogIndex({
  cases,
}: {
  cases: Array<CatalogCaseMetadata>
}) {
  const [query, setQuery] = React.useState('')
  const [family, setFamily] = React.useState('all')
  const families = React.useMemo(
    () => [...new Set(cases.map((catalogCase) => catalogCase.family))].sort(),
    [cases],
  )
  const filtered = cases.filter((catalogCase) => {
    const matchesFamily = family === 'all' || catalogCase.family === family
    const search = query.trim().toLowerCase()
    return (
      matchesFamily &&
      (!search ||
        catalogCase.title.toLowerCase().includes(search) ||
        catalogCase.features.some((feature) =>
          feature.toLowerCase().includes(search),
        ))
    )
  })

  return (
    <CatalogSurface>
      <CatalogToolbar
        count={filtered.length}
        family={family}
        families={families}
        query={query}
        setFamily={setFamily}
        setQuery={setQuery}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((catalogCase) => (
          <Link
            key={catalogCase.id}
            to="/charts/catalog/charts/$caseId"
            params={{ caseId: catalogCase.id }}
            search={true}
            className="group rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-400 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-blue-600"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-semibold leading-snug text-gray-950 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {catalogCase.title}
              </h2>
              <span className="shrink-0 font-mono text-xs text-gray-400">
                {String(catalogCase.order).padStart(2, '0')}
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {catalogCase.family}
            </p>
          </Link>
        ))}
      </div>
    </CatalogSurface>
  )
}

export function ChartsCatalogAll({
  artifactRevision,
  cases,
}: {
  artifactRevision: string
  cases: Array<CatalogCaseMetadata & { modules: CatalogCaseModules }>
}) {
  const [query, setQuery] = React.useState('')
  const [family, setFamily] = React.useState('all')
  const families = React.useMemo(
    () => [...new Set(cases.map((catalogCase) => catalogCase.family))].sort(),
    [cases],
  )
  const filtered = cases.filter((catalogCase) => {
    const search = query.trim().toLowerCase()
    return (
      (family === 'all' || catalogCase.family === family) &&
      (!search || catalogCase.title.toLowerCase().includes(search))
    )
  })

  return (
    <CatalogSurface wide>
      <CatalogToolbar
        count={filtered.length}
        family={family}
        families={families}
        query={query}
        setFamily={setFamily}
        setQuery={setQuery}
      />
      <div className="space-y-4">
        {filtered.map((catalogCase) => (
          <article
            key={catalogCase.id}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <Link
                to="/charts/catalog/charts/$caseId"
                params={{ caseId: catalogCase.id }}
                search={true}
                className="font-semibold text-gray-950 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
              >
                {catalogCase.title}
              </Link>
              <span className="text-xs text-gray-500">
                {catalogCase.family}
              </span>
            </div>
            <div
              className={
                catalogCase.modules.comparison
                  ? 'grid gap-6 xl:grid-cols-2'
                  : ''
              }
            >
              <ChartPanel label="TanStack">
                <ChartsCatalogChart
                  artifactRevision={artifactRevision}
                  caseId={catalogCase.id}
                  defer
                  module={catalogCase.modules.tanstack}
                />
              </ChartPanel>
              {catalogCase.modules.comparison ? (
                <ChartPanel
                  label={rendererLabel(catalogCase.modules.comparison.renderer)}
                >
                  <ChartsCatalogChart
                    artifactRevision={artifactRevision}
                    caseId={`${catalogCase.id}-comparison`}
                    defer
                    module={catalogCase.modules.comparison}
                  />
                </ChartPanel>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </CatalogSurface>
  )
}

export function ChartsCatalogDetail({
  artifactRevision,
  catalogCase,
}: {
  artifactRevision: string
  catalogCase: CatalogCaseMetadata & {
    modules: CatalogCaseModules
    code: {
      tanstack: { path: string; source: string }
      comparison?: { path: string; source?: string }
    }
  }
}) {
  const [revision, setRevision] = React.useState(0)
  const [width, setWidth] = React.useState<'wide' | 'compact'>('wide')
  const comparison = catalogCase.modules.comparison

  return (
    <CatalogSurface wide>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <Link
            to="/charts/catalog"
            search={true}
            className="text-sm text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Catalog
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-3xl">
            {catalogCase.title}
          </h1>
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
            <span>{catalogCase.family}</span>
            <a
              href={catalogCase.source.url}
              rel="noreferrer"
              target="_blank"
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              Reference
            </a>
          </div>
        </div>
        <div className="flex rounded-lg border border-gray-200 p-1 text-xs dark:border-gray-800">
          <button
            type="button"
            className={`rounded px-3 py-2 ${width === 'compact' ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
            onClick={() => setWidth('compact')}
          >
            640
          </button>
          <button
            type="button"
            className={`rounded px-3 py-2 ${width === 'wide' ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
            onClick={() => setWidth('wide')}
          >
            960
          </button>
          <button
            type="button"
            className="rounded px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setRevision((value) => (value === 0 ? 1 : 0))}
          >
            Revision {revision}
          </button>
        </div>
      </div>

      <div
        className={`mx-auto grid gap-6 ${comparison ? 'xl:grid-cols-2' : ''} ${
          width === 'compact' ? 'max-w-[640px]' : 'max-w-[960px]'
        }`}
      >
        <ChartPanel label="TanStack">
          <ChartsCatalogChart
            artifactRevision={artifactRevision}
            caseId={catalogCase.id}
            module={catalogCase.modules.tanstack}
            revision={revision}
          />
        </ChartPanel>
        {comparison ? (
          <ChartPanel label={rendererLabel(comparison.renderer)}>
            <ChartsCatalogChart
              artifactRevision={artifactRevision}
              caseId={`${catalogCase.id}-comparison`}
              module={comparison}
              revision={revision}
            />
          </ChartPanel>
        ) : null}
      </div>

      <div className={`mt-6 grid gap-3 ${comparison ? 'xl:grid-cols-2' : ''}`}>
        <SourceBlock
          path={catalogCase.code.tanstack.path}
          source={catalogCase.code.tanstack.source}
        />
        {catalogCase.code.comparison?.source ? (
          <SourceBlock
            path={catalogCase.code.comparison.path}
            source={catalogCase.code.comparison.source}
          />
        ) : null}
      </div>
    </CatalogSurface>
  )
}

function CatalogSurface({
  children,
  wide = false,
}: {
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <main
      className={`mx-auto min-h-[calc(100vh-var(--navbar-height))] px-4 py-8 ${
        wide ? 'max-w-[1680px]' : 'max-w-6xl'
      }`}
    >
      {children}
    </main>
  )
}

function CatalogToolbar({
  count,
  family,
  families,
  query,
  setFamily,
  setQuery,
}: {
  count: number
  family: string
  families: Array<string>
  query: string
  setFamily: (family: string) => void
  setQuery: (query: string) => void
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <input
        aria-label="Search charts"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search"
        className="min-w-56 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950"
      />
      <select
        aria-label="Chart family"
        value={family}
        onChange={(event) => setFamily(event.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950"
      >
        <option value="all">All families</option>
        {families.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <span className="w-16 text-right font-mono text-xs text-gray-500">
        {count}
      </span>
    </div>
  )
}

function ChartPanel({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
      {children}
    </div>
  )
}

function SourceBlock({ path, source }: { path: string; source: string }) {
  return (
    <details className="min-w-0 rounded-lg border border-gray-200 dark:border-gray-800">
      <summary className="cursor-pointer px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
        {path}
      </summary>
      <pre className="max-h-[32rem] overflow-auto border-t border-gray-200 p-4 text-xs dark:border-gray-800">
        <code>{source}</code>
      </pre>
    </details>
  )
}

function rendererLabel(renderer: 'observable-plot' | 'recharts' | 'echarts') {
  if (renderer === 'observable-plot') return 'Observable Plot'
  if (renderer === 'recharts') return 'Recharts'
  return 'Apache ECharts'
}
