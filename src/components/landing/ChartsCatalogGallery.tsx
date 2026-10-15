import { ArrowUpRightIcon } from '@phosphor-icons/react/ArrowUpRight'
import { Link } from '@tanstack/react-router'

import { ChartsCatalogPreview } from '~/components/charts/ChartsCatalogPreview'
import type { getChartsCatalogLanding } from '~/utils/charts-catalog.functions'
import { shuffleWithSeed } from '~/utils/utils'

type ChartsLandingCatalog = Awaited<ReturnType<typeof getChartsCatalogLanding>>
type CatalogCase = ChartsLandingCatalog['cases'][number]

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

function compareCatalogCases(left: CatalogCase, right: CatalogCase) {
  return left.order - right.order
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
