import { ArrowsOutSimpleIcon, GridFourIcon } from '@phosphor-icons/react'
import { ClientOnly, Link } from '@tanstack/react-router'
import * as React from 'react'
import type { ChartsCatalogIndexCase } from '~/utils/charts-catalog-index'
import type { ExampleDefinition } from '~/utils/example-workspace'
import {
  chartsCatalogCollections,
  findChartsCatalogCollection,
  type ChartsCatalogAuthoredSource,
} from '~/utils/charts-catalog'
import { ChartsCatalogPreview } from './ChartsCatalogPreview'
import { ChartsCatalogSource } from './ChartsCatalogSource'

const LazyExampleWorkbench = React.lazy(() =>
  import('~/components/examples/ExampleWorkbench.client').then((module) => ({
    default: module.ExampleWorkbench,
  })),
)

type CatalogCaseMetadata = ChartsCatalogIndexCase

export function ChartsCatalog({
  cases,
  collection,
  revision,
}: {
  cases: Array<CatalogCaseMetadata>
  collection?: (typeof chartsCatalogCollections)[number]
  revision: string
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
  const availableCollections = chartsCatalogCollections
    .map((metadata) => ({
      metadata,
      count: cases.filter(
        (catalogCase) => catalogCase.collection === metadata.id,
      ).length,
    }))
    .filter((entry) => entry.count > 0)

  return (
    <CatalogSurface>
      {collection ? (
        <header className="mb-6 max-w-2xl">
          <Link
            className="text-sm text-text-muted hover:text-action-primary"
            preload={false}
            search={true}
            to="/charts/catalog"
          >
            All examples
          </Link>
          <h1 className="mt-2 font-ds-display text-3xl font-bold tracking-tight text-text-primary">
            {collection.title}
          </h1>
          <p className="mt-2 text-text-secondary">{collection.description}</p>
        </header>
      ) : availableCollections.length > 0 ? (
        <nav aria-label="Chart collections" className="mb-4 flex gap-2">
          {availableCollections.map((entry) => (
            <Link
              key={entry.metadata.id}
              className="rounded-lg border border-border-subtle bg-background-surface px-3 py-2 text-sm font-medium text-text-primary hover:border-action-primary"
              params={{ collectionId: entry.metadata.id }}
              preload={false}
              search={true}
              to="/charts/catalog/collections/$collectionId"
            >
              {entry.metadata.title}
              <span className="ml-2 font-ds-mono text-ds-mono-caps-xs text-text-muted">
                {entry.count}
              </span>
            </Link>
          ))}
        </nav>
      ) : null}
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
            className="group relative min-w-0 overflow-hidden rounded-xl border border-border-subtle bg-background-surface"
          >
            <div aria-hidden="true" className="aspect-[3/2]">
              <ChartsCatalogPreview
                caseId={catalogCase.id}
                revision={revision}
              />
            </div>
            <div className="flex min-h-16 items-center justify-between gap-4 border-t border-border-subtle px-4 py-3">
              <p className="min-w-0 truncate font-ds-display text-sm font-semibold text-text-primary">
                {catalogCase.title}
              </p>
              <span className="shrink-0 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
                {catalogCase.family}
              </span>
            </div>
            <Link
              aria-label={`Open the ${catalogCase.title} catalog example`}
              className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-inset"
              params={{ caseId: catalogCase.id }}
              preload={false}
              search={true}
              to="/charts/catalog/charts/$caseId"
            />
          </article>
        ))}
      </div>
    </CatalogSurface>
  )
}

export function ChartsCatalogDetail({
  catalogCase,
}: {
  catalogCase: CatalogCaseMetadata & {
    example: ExampleDefinition
    authoredSource: {
      tanstack: ChartsCatalogAuthoredSource
    }
  }
}) {
  const collection = catalogCase.collection
    ? findChartsCatalogCollection(catalogCase.collection)
    : undefined

  return (
    <CatalogSurface wide>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          {collection ? (
            <Link
              className="text-sm text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
              params={{ collectionId: collection.id }}
              preload={false}
              search={true}
              to="/charts/catalog/collections/$collectionId"
            >
              {collection.title}
            </Link>
          ) : (
            <Link
              className="text-sm text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
              preload={false}
              search={true}
              to="/charts/catalog"
            >
              Catalog
            </Link>
          )}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-3xl">
            {catalogCase.title}
          </h1>
          <div className="mt-3 text-xs text-gray-500">{catalogCase.family}</div>
        </div>
      </div>

      <ClientOnly
        fallback={<CatalogWorkbenchFallback catalogCase={catalogCase} />}
      >
        <React.Suspense
          fallback={<CatalogWorkbenchFallback catalogCase={catalogCase} />}
        >
          <LazyExampleWorkbench definition={catalogCase.example} />
        </React.Suspense>
      </ClientOnly>
    </CatalogSurface>
  )
}

function CatalogWorkbenchFallback({
  catalogCase,
}: {
  catalogCase: { authoredSource: { tanstack: ChartsCatalogAuthoredSource } }
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800">
      <ChartsCatalogSource source={catalogCase.authoredSource.tanstack} />
    </div>
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
        className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:text-gray-950 aria-pressed:border-blue-500 aria-pressed:text-blue-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:text-white dark:aria-pressed:border-blue-500 dark:aria-pressed:text-blue-400 sm:inline-flex"
      >
        {fullWidth ? (
          <GridFourIcon aria-hidden="true" className="size-4" />
        ) : (
          <ArrowsOutSimpleIcon aria-hidden="true" className="size-4" />
        )}
        Full width
      </button>
      <span className="text-right font-mono text-xs text-gray-500">
        {count} examples
      </span>
    </div>
  )
}
