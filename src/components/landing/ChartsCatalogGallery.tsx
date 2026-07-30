import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

import {
  ChartsCatalogChart,
  type ChartsCatalogModuleReference,
} from '~/components/charts/ChartsCatalogChart'
import type { ChartsCatalogCase } from '~/utils/charts-catalog'
import { chartsCatalogDocsTargets } from './chartsCatalogDocsTargets'

type CatalogCase = Pick<
  ChartsCatalogCase,
  'family' | 'id' | 'order' | 'routes' | 'title'
> & {
  modules: {
    tanstack: ChartsCatalogModuleReference
  }
}

export type ChartsLandingCatalog = {
  artifactRevision: string
  revision: string
  cases: Array<CatalogCase>
}

type CatalogExample = {
  caseId: string
  label: string
}

type CatalogFamily = {
  charts: ReadonlyArray<CatalogExample>
  question: string
  representative: CatalogExample
  shortLabel: string
}

const catalogFamilies = [
  {
    charts: [
      { caseId: '55-indexed-multi-line', label: 'Line' },
      { caseId: '03-temperature-range-band', label: 'Range area' },
      { caseId: '04-stacked-time-area', label: 'Stacked area' },
      { caseId: '21-streamgraph', label: 'Streamgraph' },
      { caseId: '28-candlestick', label: 'Candlestick' },
    ],
    question: 'How did it change over time?',
    representative: {
      caseId: '19-moving-average-line',
      label: 'Moving average',
    },
    shortLabel: 'Time',
  },
  {
    charts: [
      { caseId: 'bar-vertical-sorted', label: 'Bar' },
      { caseId: '16-lollipop', label: 'Lollipop' },
      { caseId: '17-dumbbell', label: 'Dumbbell' },
      { caseId: '98-needle-gauge', label: 'Threshold gauge' },
      { caseId: '75-radar', label: 'Radar profile' },
    ],
    question: 'How do values compare?',
    representative: {
      caseId: '30-slopegraph',
      label: 'Slopegraph',
    },
    shortLabel: 'Compare',
  },
  {
    charts: [
      { caseId: '29-waterfall', label: 'Waterfall' },
      { caseId: '76-pie', label: 'Pie' },
      { caseId: '94-center-donut', label: 'Donut' },
      { caseId: '101-sunburst', label: 'Sunburst' },
    ],
    question: 'What makes up the total?',
    representative: {
      caseId: '64-marimekko-mosaic',
      label: 'Marimekko',
    },
    shortLabel: 'Composition',
  },
  {
    charts: [
      { caseId: 'histogram', label: 'Histogram' },
      { caseId: '15-boxplot', label: 'Box plot' },
      { caseId: '63-violin-distributions', label: 'Violin' },
      { caseId: '51-faceted-distributions', label: 'Faceted histograms' },
    ],
    question: 'How are values distributed?',
    representative: {
      caseId: '62-ridgeline-density',
      label: 'Ridgeline density',
    },
    shortLabel: 'Distribution',
  },
  {
    charts: [
      { caseId: '31-linear-regression', label: 'Scatter + regression' },
      { caseId: '24-quantitative-binned-heatmap', label: 'Binned heatmap' },
      { caseId: '39-density-contours', label: 'Density contours' },
      { caseId: '43-hexbin-density', label: 'Hexbin' },
    ],
    question: 'How do variables relate?',
    representative: {
      caseId: '56-connected-scatter',
      label: 'Connected scatter',
    },
    shortLabel: 'Relationship',
  },
  {
    charts: [
      { caseId: '13-interval-timeline', label: 'Interval timeline' },
      { caseId: '14-error-bars', label: 'Error bars' },
    ],
    question: 'What is the range or duration?',
    representative: {
      caseId: '61-quantile-ribbon',
      label: 'Percentile ribbon',
    },
    shortLabel: 'Range',
  },
  {
    charts: [
      { caseId: '36-hierarchy-tree', label: 'Hierarchy tree' },
      { caseId: '40-force-directed-network', label: 'Force-directed network' },
    ],
    question: 'How is it connected?',
    representative: {
      caseId: '37-delaunay-network',
      label: 'Delaunay network',
    },
    shortLabel: 'Connection',
  },
  {
    charts: [
      { caseId: '102-world-choropleth', label: 'Choropleth' },
      { caseId: '103-bubble-map', label: 'Bubble map' },
    ],
    question: 'How does it vary by location?',
    representative: {
      caseId: '105-route-map',
      label: 'Route map',
    },
    shortLabel: 'Location',
  },
] as const satisfies ReadonlyArray<CatalogFamily>

export function ChartsCatalogGallery({
  catalog,
  variant,
  version,
}: {
  catalog: ChartsLandingCatalog
  variant: 'compact' | 'expanded'
  version: string
}) {
  const casesById = new Map(
    catalog.cases.map((catalogCase) => [catalogCase.id, catalogCase]),
  )

  if (variant === 'compact') {
    const orderedCases = [...catalog.cases].sort(
      (left, right) => left.order - right.order,
    )

    return (
      <div className="-mx-5 overflow-x-auto px-5 pb-3 [scrollbar-color:rgb(var(--landing-glow)/0.48)_transparent] md:-mx-10 md:px-10 lg:-mx-12 lg:px-12 2xl:-mx-20 2xl:px-20">
        <div className="grid min-w-max grid-flow-col grid-rows-2 border-l border-t border-border-subtle">
          {orderedCases.map((catalogCase) => (
            <CatalogChartTile
              key={catalogCase.id}
              artifactRevision={catalog.artifactRevision}
              catalogCase={catalogCase}
              version={version}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid border-t border-border-subtle md:grid-cols-2">
      {catalogFamilies.map((family, familyIndex) => (
        <section
          key={family.shortLabel}
          className={`flex min-w-0 flex-col border-b border-border-subtle ${
            familyIndex % 2 === 0 ? 'md:border-r' : ''
          }`}
        >
          <header className="flex-1 px-1 py-5 sm:px-5 sm:py-6">
            <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
              {family.shortLabel}
            </p>
            <h3 className="mt-2 max-w-xl font-ds-display text-ds-heading-3 text-text-primary">
              {family.question}
            </h3>

            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {family.charts.map((example) => {
                const catalogCase = casesById.get(example.caseId)
                if (!catalogCase) return null

                return (
                  <li key={example.caseId}>
                    <CatalogCaseLink
                      catalogCase={catalogCase}
                      label={example.label}
                      version={version}
                    >
                      {example.label}
                    </CatalogCaseLink>
                  </li>
                )
              })}
            </ul>
          </header>

          <CatalogFamilyPreview
            artifactRevision={catalog.artifactRevision}
            catalogCase={casesById.get(family.representative.caseId)}
            family={family}
            version={version}
          />
        </section>
      ))}
    </div>
  )
}

function CatalogChartTile({
  artifactRevision,
  catalogCase,
  version,
}: {
  artifactRevision: string
  catalogCase: CatalogCase
  version: string
}) {
  const displayHeight = 112
  const renderHeight = displayHeight * 2
  const renderWidth = 304

  return (
    <figure className="group w-40 min-w-0 border-b border-r border-border-subtle bg-background-surface">
      <div className="relative h-28 overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgb(var(--landing-glow)/0.09),transparent_66%)]">
        <div
          className="absolute left-1/2 top-0 origin-top -translate-x-1/2 scale-50"
          style={{ width: renderWidth }}
        >
          <ChartsCatalogChart
            artifactRevision={artifactRevision}
            caseId={catalogCase.id}
            defer
            height={renderHeight}
            interactive
            logicalWidth={renderWidth}
            module={catalogCase.modules.tanstack}
          />
        </div>
      </div>

      <figcaption>
        <CatalogCaseLink
          catalogCase={catalogCase}
          label={catalogCase.title}
          version={version}
          className="flex h-12 items-center justify-between gap-2 border-t border-border-subtle px-3 font-ds-mono text-[9px] font-semibold uppercase leading-4 tracking-[0.08em] text-text-secondary transition-colors hover:bg-[color:rgb(var(--landing-glow)/0.1)] hover:text-[var(--landing-accent-bright)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--landing-accent-bright)]"
        >
          <span className="line-clamp-2">{catalogCase.title}</span>
          <ArrowUpRight
            aria-hidden="true"
            className="size-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </CatalogCaseLink>
      </figcaption>
    </figure>
  )
}

function CatalogFamilyPreview({
  artifactRevision,
  catalogCase,
  family,
  version,
}: {
  artifactRevision: string
  catalogCase: CatalogCase | undefined
  family: CatalogFamily
  version: string
}) {
  if (!catalogCase) return null

  const height = 176

  return (
    <figure className="group min-w-0 border-t border-border-subtle bg-background-surface">
      <div className="overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgb(var(--landing-glow)/0.08),transparent_68%)]">
        <ChartsCatalogChart
          artifactRevision={artifactRevision}
          caseId={catalogCase.id}
          defer
          height={height}
          interactive
          module={catalogCase.modules.tanstack}
        />
      </div>

      <figcaption>
        <CatalogCaseLink
          catalogCase={catalogCase}
          label={family.representative.label}
          version={version}
          className="flex min-h-10 items-center justify-between gap-3 border-t border-border-subtle px-4 font-ds-mono text-ds-mono-caps-xs uppercase text-text-secondary transition-colors hover:bg-[color:rgb(var(--landing-glow)/0.1)] hover:text-[var(--landing-accent-bright)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--landing-accent-bright)]"
        >
          <span>Open {family.representative.label}</span>
          <ArrowUpRight
            aria-hidden="true"
            className="size-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </CatalogCaseLink>
      </figcaption>
    </figure>
  )
}

function CatalogCaseLink({
  catalogCase,
  children,
  className = 'inline-flex items-center gap-1 border-b border-border-default text-ds-body-xs font-semibold leading-5 text-text-secondary transition-colors hover:border-[var(--landing-accent-bright)] hover:text-[var(--landing-accent-bright)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]',
  label,
  version,
}: {
  catalogCase: CatalogCase
  children: ReactNode
  className?: string
  label: string
  version: string
}) {
  const docsTarget = chartsCatalogDocsTargets[catalogCase.id]

  if (!docsTarget) {
    return (
      <Link
        to="/charts/catalog/charts/$caseId"
        params={{ caseId: catalogCase.id }}
        search={{}}
        preload={false}
        className={className}
        aria-label={`Open the ${label} catalog example`}
      >
        {children}
      </Link>
    )
  }

  const frameworkTarget = docsTarget.path.match(/^framework\/([^/]+)\/(.+)$/)

  if (frameworkTarget) {
    return (
      <Link
        to="/$libraryId/$version/docs/framework/$framework/$"
        params={{
          libraryId: 'charts',
          version,
          framework: frameworkTarget[1],
          _splat: frameworkTarget[2],
        }}
        hash={docsTarget.anchor}
        preload={false}
        className={className}
        aria-label={`Open the ${label} example in the Charts docs`}
      >
        {children}
      </Link>
    )
  }

  return (
    <Link
      to="/$libraryId/$version/docs/$"
      params={{
        libraryId: 'charts',
        version,
        _splat: docsTarget.path,
      }}
      hash={docsTarget.anchor}
      preload={false}
      className={className}
      aria-label={`Open the ${label} example in the Charts docs`}
    >
      {children}
    </Link>
  )
}
