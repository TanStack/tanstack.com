import { ArrowsOutSimple, GridFour } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import * as React from 'react'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import type { ChartsCatalogCase } from '~/utils/charts-catalog'
import {
  ChartsCatalogChart,
  type ChartsCatalogModuleReference,
} from './ChartsCatalogChart'
import { Resizable, type ResizableSizeChange } from '../npm-stats/Resizable'

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

export function ChartsCatalog({
  artifactRevision,
  cases,
}: {
  artifactRevision: string
  cases: Array<CatalogCaseMetadata & { modules: CatalogCaseModules }>
}) {
  const [query, setQuery] = React.useState('')
  const [family, setFamily] = React.useState('all')
  const [fullWidth, setFullWidth] = React.useState(false)
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
        fullWidth={fullWidth}
        query={query}
        setFamily={setFamily}
        setFullWidth={setFullWidth}
        setQuery={setQuery}
      />
      <div
        className={`grid gap-4 ${
          fullWidth ? '' : 'sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {filtered.map((catalogCase) => (
          <article
            key={catalogCase.id}
            className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
          >
            <div className="flex items-start justify-between gap-4">
              <Link
                to="/charts/catalog/charts/$caseId"
                params={{ caseId: catalogCase.id }}
                search={true}
                className="font-semibold leading-snug text-gray-950 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
              >
                {catalogCase.title}
              </Link>
              <span className="shrink-0 text-xs text-gray-500">
                {catalogCase.family}
              </span>
            </div>
            <div className="mt-4">
              <ResizableCatalogChart
                key={`${catalogCase.id}:${fullWidth ? 'full' : 'grid'}`}
                artifactRevision={artifactRevision}
                caseId={catalogCase.id}
                defer
                initialHeight={fullWidth ? 420 : 320}
                module={catalogCase.modules.tanstack}
              />
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
          <div className="mt-3 text-xs text-gray-500">{catalogCase.family}</div>
        </div>
      </div>

      <div className={`grid gap-6 ${comparison ? 'xl:grid-cols-2' : ''}`}>
        <ChartPanel label="TanStack">
          <ResizableCatalogChart
            artifactRevision={artifactRevision}
            caseId={catalogCase.id}
            module={catalogCase.modules.tanstack}
          />
        </ChartPanel>
        {comparison ? (
          <ChartPanel label={rendererLabel(comparison.renderer)}>
            <ResizableCatalogChart
              artifactRevision={artifactRevision}
              caseId={`${catalogCase.id}-comparison`}
              module={comparison}
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

function ResizableCatalogChart({
  artifactRevision,
  caseId,
  defer = false,
  initialHeight = 360,
  module,
}: {
  artifactRevision: string
  caseId: string
  defer?: boolean
  initialHeight?: number
  module: ChartsCatalogModuleReference
}) {
  const [height, setHeight] = React.useState(initialHeight)
  const [width, setWidth] = React.useState<number | undefined>(undefined)

  const onSizeChange = React.useCallback((size: ResizableSizeChange) => {
    if (size.height !== undefined) setHeight(size.height)
    if ('width' in size) setWidth(size.width)
  }, [])

  return (
    <Resizable height={height} width={width} onSizeChange={onSizeChange}>
      <ChartsCatalogChart
        artifactRevision={artifactRevision}
        caseId={caseId}
        defer={defer}
        height={height}
        module={module}
      />
    </Resizable>
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
      className={`mx-auto min-h-[calc(100vh-var(--navbar-height))] w-full px-4 py-8 ${
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
  fullWidth,
  query,
  setFamily,
  setFullWidth,
  setQuery,
}: {
  count: number
  family: string
  families: Array<string>
  fullWidth: boolean
  query: string
  setFamily: (family: string) => void
  setFullWidth: (fullWidth: boolean) => void
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
      <button
        type="button"
        aria-pressed={fullWidth}
        onClick={() => setFullWidth(!fullWidth)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:text-gray-950 aria-pressed:border-blue-500 aria-pressed:text-blue-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:text-white dark:aria-pressed:border-blue-500 dark:aria-pressed:text-blue-400"
      >
        {fullWidth ? (
          <GridFour aria-hidden="true" className="size-4" />
        ) : (
          <ArrowsOutSimple aria-hidden="true" className="size-4" />
        )}
        Full width
      </button>
      <span className="text-right font-mono text-xs text-gray-500">
        {count} examples
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
      <CodeBlock
        showTypeCopyButton={false}
        className="max-h-[32rem] rounded-none border-x-0 border-b-0 [&_pre]:max-h-[32rem] [&_pre]:overflow-auto"
      >
        <code className="language-ts">{source}</code>
      </CodeBlock>
    </details>
  )
}

function rendererLabel(renderer: 'observable-plot' | 'recharts' | 'echarts') {
  if (renderer === 'observable-plot') return 'Observable Plot'
  if (renderer === 'recharts') return 'Recharts'
  return 'Apache ECharts'
}
