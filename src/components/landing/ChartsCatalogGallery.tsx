import { ArrowUpRightIcon } from '@phosphor-icons/react/ArrowUpRight'
import { Link } from '@tanstack/react-router'

import { ChartsCatalogPreview } from '~/components/charts/ChartsCatalogPreview'
import type { getChartsCatalogLanding } from '~/utils/charts-catalog.functions'
import { shuffleWithSeed } from '~/utils/utils'

type ChartsLandingCatalog = Awaited<ReturnType<typeof getChartsCatalogLanding>>
type CatalogCase = ChartsLandingCatalog['cases'][number]

export const chartsLandingHeroCaseIds = [
  '03-temperature-range-band',
  'bar-grouped',
  'scatter-bubble',
] as const

export function CatalogChartsHero({
  catalog,
}: {
  catalog: ChartsLandingCatalog
}) {
  const casesById = new Map(
    catalog.cases.map((catalogCase) => [catalogCase.id, catalogCase]),
  )
  const heroCases = chartsLandingHeroCaseIds.flatMap((caseId) => {
    const catalogCase = casesById.get(caseId)
    return catalogCase ? [catalogCase] : []
  })

  if (heroCases.length === 0) return null

  return (
    <section
      aria-label="Chart catalog examples"
      className="library-landing-graphic min-w-0"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:grid-rows-2">
        {heroCases.map((catalogCase, index) => (
          <HeroChartTile
            catalogCase={catalogCase}
            featured={index === 0}
            key={catalogCase.id}
            revision={catalog.revision}
          />
        ))}
      </div>
    </section>
  )
}

function HeroChartTile({
  catalogCase,
  featured,
  revision,
}: {
  catalogCase: CatalogCase
  featured: boolean
  revision: string
}) {
  return (
    <figure
      className={
        featured ? 'col-span-2 min-w-0 sm:col-span-1 sm:row-span-2' : 'min-w-0'
      }
    >
      <div className="group relative overflow-hidden rounded-2xl corner-squircle border border-border-subtle bg-background-surface shadow-[0_24px_55px_-28px_rgb(3_18_25/0.42)]">
        <div className="aspect-[3/2]">
          <ChartsCatalogPreview caseId={catalogCase.id} revision={revision} />
        </div>
        <Link
          aria-label={`Open the ${catalogCase.title} catalog example`}
          className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] focus-visible:ring-offset-4 focus-visible:ring-offset-background-default"
          params={{ caseId: catalogCase.id }}
          preload={false}
          search={{}}
          to="/charts/catalog/charts/$caseId"
        >
          <ArrowUpRightIcon
            aria-hidden="true"
            className="absolute right-4 top-4 size-5 text-text-muted"
          />
        </Link>
      </div>

      <figcaption className="mt-2 min-w-0 px-1">
        <p className="truncate font-ds-display text-sm font-semibold text-text-primary xl:text-base">
          {catalogCase.title}
        </p>
        <p className="mt-0.5 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
          {catalogCase.family}
        </p>
      </figcaption>
    </figure>
  )
}

export function ChartsCatalogGallery({
  catalog,
  orderSeed,
}: {
  catalog: ChartsLandingCatalog
  orderSeed: string
}) {
  const shuffledCases = shuffleWithSeed(
    [...catalog.cases].sort(compareCatalogCases),
    orderSeed,
    (catalogCase) => catalogCase.id,
  )

  return (
    <div className="fade-x fade-size-x-sm -mx-5 overflow-x-auto overscroll-x-contain px-5 pb-5 [scrollbar-color:rgb(var(--landing-glow)/0.48)_transparent] md:-mx-10 md:px-10 lg:-mx-12 lg:px-12 2xl:-mx-20 2xl:px-20">
      <div className="grid min-w-max snap-x snap-proximity grid-flow-col grid-rows-3 auto-cols-[min(74vw,18rem)] gap-3 sm:auto-cols-[18rem]">
        {shuffledCases.map((catalogCase) => (
          <CatalogChartCard
            catalogCase={catalogCase}
            key={catalogCase.id}
            revision={catalog.revision}
          />
        ))}
      </div>
    </div>
  )
}

function CatalogChartCard({
  catalogCase,
  revision,
}: {
  catalogCase: CatalogCase
  revision: string
}) {
  return (
    <div className="charts-catalog-gallery-card group relative block snap-start overflow-hidden rounded-xl corner-squircle border border-border-subtle bg-background-surface shadow-[0_16px_35px_-26px_rgb(3_18_25/0.5)]">
      <div aria-hidden="true" className="relative aspect-[3/2] overflow-hidden">
        <ChartsCatalogPreview caseId={catalogCase.id} revision={revision} />
      </div>
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-ds-display text-sm font-semibold">
            {catalogCase.title}
          </p>
          <p className="mt-0.5 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
            {catalogCase.family}
          </p>
        </div>
        <ArrowUpRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-text-muted"
        />
      </div>
      <Link
        aria-label={`Open the ${catalogCase.title} catalog example`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] focus-visible:ring-offset-3 focus-visible:ring-offset-background-subtle"
        params={{ caseId: catalogCase.id }}
        preload={false}
        search={{}}
        to="/charts/catalog/charts/$caseId"
      />
    </div>
  )
}

function compareCatalogCases(left: CatalogCase, right: CatalogCase) {
  return left.order - right.order
}
