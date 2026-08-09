import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from '@phosphor-icons/react/ArrowRight'
import { ArrowUpRightIcon } from '@phosphor-icons/react/ArrowUpRight'
import { PauseIcon } from '@phosphor-icons/react/Pause'
import { PlayIcon } from '@phosphor-icons/react/Play'

import { ChartsCatalogChart } from '~/components/charts/ChartsCatalogChart'
import { useInView } from '~/hooks/useInView'
import type { getChartsCatalogLanding } from '~/utils/charts-catalog.functions'
import { getChartsCatalogPreviewUrl } from '~/utils/charts-catalog'
import { shuffleWithSeed } from '~/utils/utils'

type ChartsLandingCatalog = Awaited<ReturnType<typeof getChartsCatalogLanding>>
type CatalogCase = ChartsLandingCatalog['cases'][number]
type HeroChart = {
  catalogCase: CatalogCase
}
type HeroChartPhase = 'current' | 'entering' | 'exiting' | 'pending'

const heroIntervals = [2_700, 2_700, 3_000, 3_300] as const
const heroTileClasses = [
  'xl:hidden',
  'hidden md:block',
  'hidden lg:block',
] as const
export const chartsLandingHeroCaseIdsByTile = [
  ['03-temperature-range-band', '01-line-gaps'],
  ['bar-grouped', '04-stacked-time-area'],
  ['bar-vertical-sorted', '14-error-bars'],
  ['bar-stacked', 'scatter-bubble'],
] as const
export const chartsLandingInitialHeroCaseIds =
  chartsLandingHeroCaseIdsByTile.map(([caseId]) => caseId)

export function CatalogChartsHero({
  catalog,
}: {
  catalog: ChartsLandingCatalog
}) {
  const heroCasePools = React.useMemo(() => {
    const casesById = new Map(
      catalog.cases.map((catalogCase) => [catalogCase.id, catalogCase]),
    )
    return chartsLandingHeroCaseIdsByTile.map((caseIds) =>
      caseIds.flatMap((caseId) => {
        const catalogCase = casesById.get(caseId)
        return catalogCase ? [catalogCase] : []
      }),
    )
  }, [catalog.cases])
  const rootRef = React.useRef<HTMLElement>(null)
  const [activePositions, setActivePositions] = React.useState<number[]>(() =>
    chartsLandingHeroCaseIdsByTile.map(() => 0),
  )
  const [focused, setFocused] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const inView = useInView(rootRef, { threshold: 0.2 })
  const [pageVisible, setPageVisible] = React.useState(true)
  const [paused, setPaused] = React.useState(false)
  const reducedMotion = useReducedMotion()
  const { featuredLayout, visibleStandardTileCount } = useHeroLayout()
  const running =
    !paused && !reducedMotion && !focused && !hovered && inView && pageVisible

  React.useEffect(() => {
    const updateVisibility = () =>
      setPageVisible(document.visibilityState === 'visible')
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () =>
      document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  const advanceTile = React.useCallback(
    (tileIndex: number) => {
      React.startTransition(() => {
        setActivePositions((positions) =>
          positions.map((position, indexToUpdate) =>
            indexToUpdate === tileIndex
              ? (position + 1) % (heroCasePools[tileIndex]?.length ?? 1)
              : position,
          ),
        )
      })
    },
    [heroCasePools],
  )

  const advanceAll = React.useCallback(() => {
    React.startTransition(() => {
      setActivePositions((positions) =>
        positions.map(
          (position, tileIndex) =>
            (position + 1) % (heroCasePools[tileIndex]?.length ?? 1),
        ),
      )
    })
  }, [heroCasePools])

  const firstCase = heroCasePools[0]?.[0]
  if (!firstCase) return null

  const featuredCase = heroCasePools[0]?.[activePositions[0] ?? 0] ?? firstCase

  return (
    <section
      ref={rootRef}
      className="library-landing-graphic min-w-0"
      aria-label="Rotating chart catalog examples"
      onBlurCapture={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setFocused(false)
        }
      }}
      onFocusCapture={() => setFocused(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
        <HeroChartTile
          artifactRevision={catalog.artifactRevision}
          caseCount={heroCasePools[0]?.length ?? 1}
          featured
          tileIndex={0}
          catalogCase={featuredCase}
          className="hidden xl:col-span-2 xl:block"
          intervalMs={heroIntervals[0]}
          onAdvance={advanceTile}
          reducedMotion={reducedMotion}
          running={running && featuredLayout}
        />
        {heroIntervals.slice(1).map((intervalMs, standardIndex) => {
          const tileIndex = standardIndex + 1
          const activeCase =
            heroCasePools[tileIndex]?.[activePositions[tileIndex] ?? 0] ??
            firstCase

          return (
            <HeroChartTile
              artifactRevision={catalog.artifactRevision}
              caseCount={heroCasePools[tileIndex]?.length ?? 1}
              key={`standard-${tileIndex}`}
              tileIndex={tileIndex}
              catalogCase={activeCase}
              className={heroTileClasses[standardIndex]}
              intervalMs={intervalMs}
              onAdvance={advanceTile}
              reducedMotion={reducedMotion}
              running={
                running &&
                (featuredLayout
                  ? standardIndex > 0
                  : standardIndex < visibleStandardTileCount)
              }
            />
          )
        })}
      </div>

      <div className="mt-2 flex justify-end px-1">
        <button
          type="button"
          aria-label={
            reducedMotion
              ? 'Show next chart'
              : paused
                ? 'Resume chart rotation'
                : 'Pause chart rotation'
          }
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors duration-200 hover:bg-text-primary/5 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
          onClick={() => {
            if (reducedMotion) {
              advanceAll()
              return
            }
            setPaused((value) => !value)
          }}
        >
          {reducedMotion ? (
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          ) : paused ? (
            <PlayIcon aria-hidden="true" className="size-4 translate-x-px" />
          ) : (
            <PauseIcon aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
    </section>
  )
}

function HeroChartTile({
  artifactRevision,
  caseCount,
  catalogCase,
  className,
  featured = false,
  intervalMs,
  onAdvance,
  reducedMotion,
  running,
  tileIndex,
}: {
  artifactRevision: string
  caseCount: number
  catalogCase: CatalogCase
  className: string
  featured?: boolean
  intervalMs: number
  onAdvance: (tileIndex: number) => void
  reducedMotion: boolean
  running: boolean
  tileIndex: number
}) {
  const [activeChart, setActiveChart] = React.useState<HeroChart>(() => ({
    catalogCase,
  }))
  const [exitingChart, setExitingChart] = React.useState<HeroChart>()
  const [hydratedCaseId, setHydratedCaseId] = React.useState<string>()
  const desiredCaseIdRef = React.useRef(catalogCase.id)
  desiredCaseIdRef.current = catalogCase.id

  const activeCaseId = activeChart.catalogCase.id

  React.useEffect(() => {
    if (
      !running ||
      exitingChart ||
      caseCount < 2 ||
      activeCaseId !== catalogCase.id ||
      hydratedCaseId !== activeCaseId
    ) {
      return
    }

    const timeout = window.setTimeout(() => onAdvance(tileIndex), intervalMs)
    return () => window.clearTimeout(timeout)
  }, [
    activeCaseId,
    caseCount,
    catalogCase.id,
    exitingChart,
    hydratedCaseId,
    intervalMs,
    onAdvance,
    running,
    tileIndex,
  ])

  const handleHydrated = React.useCallback(
    (chart: HeroChart) => {
      const hydratedId = chart.catalogCase.id

      if (hydratedId === activeChart.catalogCase.id) {
        setHydratedCaseId(hydratedId)
        return
      }

      if (hydratedId !== desiredCaseIdRef.current) return

      setHydratedCaseId(hydratedId)
      if (!reducedMotion) setExitingChart(activeChart)
      setActiveChart(chart)
    },
    [activeChart, reducedMotion],
  )

  const activeCase = activeChart.catalogCase

  return (
    <figure className={`min-w-0 ${className}`}>
      <div className="group relative">
        <div className="overflow-hidden rounded-2xl shadow-[0_24px_55px_-28px_rgb(3_18_25/0.58)]">
          <div
            className={`relative ${featured ? 'aspect-[3/1]' : 'aspect-[3/2]'}`}
          >
            {exitingChart ? (
              <>
                <HeroChartFrame
                  artifactRevision={artifactRevision}
                  key={exitingChart.catalogCase.id}
                  chart={exitingChart}
                  onHydrated={handleHydrated}
                  phase="exiting"
                />
                <HeroChartFrame
                  artifactRevision={artifactRevision}
                  key={activeCase.id}
                  chart={activeChart}
                  onEntered={() => setExitingChart(undefined)}
                  onHydrated={handleHydrated}
                  phase="entering"
                />
              </>
            ) : (
              <>
                <HeroChartFrame
                  artifactRevision={artifactRevision}
                  key={activeCase.id}
                  chart={activeChart}
                  onHydrated={handleHydrated}
                  phase="current"
                />
                {activeCase.id === catalogCase.id ? null : (
                  <HeroChartFrame
                    artifactRevision={artifactRevision}
                    key={catalogCase.id}
                    chart={{ catalogCase }}
                    onHydrated={handleHydrated}
                    phase="pending"
                  />
                )}
              </>
            )}
          </div>
        </div>
        <Link
          to="/charts/catalog/charts/$caseId"
          params={{ caseId: activeCase.id }}
          search={{}}
          preload={false}
          aria-label={`Open the ${activeCase.title} catalog example`}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] focus-visible:ring-offset-4 focus-visible:ring-offset-background-default"
        >
          <ArrowUpRightIcon
            aria-hidden="true"
            className="absolute right-4 top-4 size-5 text-current opacity-60 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      </div>

      <figcaption className="mt-2 min-w-0 px-1">
        <p
          key={activeCase.id}
          className="charts-catalog-title-enter truncate font-ds-display text-sm font-semibold text-text-primary xl:text-base"
        >
          {activeCase.title}
        </p>
        <p className="mt-0.5 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
          {activeCase.family}
        </p>
      </figcaption>
    </figure>
  )
}

function HeroChartFrame({
  artifactRevision,
  chart,
  onEntered,
  onHydrated,
  phase,
}: {
  artifactRevision: string
  chart: HeroChart
  onEntered?: () => void
  onHydrated: (chart: HeroChart) => void
  phase: HeroChartPhase
}) {
  const { catalogCase } = chart
  const [ready, setReady] = React.useState(false)
  const previewSrc = getChartsCatalogPreviewUrl(
    artifactRevision,
    catalogCase.preview.path,
  )
  const handleHydrated = React.useCallback(() => {
    setReady(true)
    onHydrated(chart)
  }, [chart, onHydrated])
  const handleTransitionComplete = (
    event: React.TransitionEvent<HTMLDivElement>,
  ) => {
    if (
      phase === 'entering' &&
      event.target === event.currentTarget &&
      event.propertyName === 'opacity'
    ) {
      onEntered?.()
    }
  }

  return (
    <div
      aria-hidden="true"
      className={`charts-catalog-hero-frame charts-catalog-hero-frame-${phase} charts-catalog-card absolute inset-0`}
      inert
      onTransitionCancel={handleTransitionComplete}
      onTransitionEnd={handleTransitionComplete}
    >
      <img
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${
          ready ? 'opacity-0' : 'opacity-100'
        }`}
        height={192}
        src={previewSrc}
        width={288}
      />
      <div
        className={`absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <ChartsCatalogChart
          artifactRevision={artifactRevision}
          caseId={catalogCase.id}
          fill
          interactive={false}
          module={catalogCase.module}
          onStatus={(status) => {
            if (status === 'ready') handleHydrated()
          }}
          preview
        />
      </div>
    </div>
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
            key={catalogCase.id}
            catalogCase={catalogCase}
            src={getChartsCatalogPreviewUrl(
              catalog.artifactRevision,
              catalogCase.preview.path,
            )}
          />
        ))}
      </div>
    </div>
  )
}

function CatalogChartCard({
  catalogCase,
  src,
}: {
  catalogCase: CatalogCase
  src?: string
}) {
  return (
    <div className="charts-catalog-gallery-card charts-catalog-card group relative block snap-start overflow-hidden rounded-xl shadow-[0_16px_35px_-26px_rgb(3_18_25/0.65)] transition-[translate,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgb(3_18_25/0.75)] motion-reduce:transition-none">
      <div
        aria-hidden="true"
        className="relative aspect-[3/2] overflow-hidden"
        inert
      >
        {src ? (
          <img
            alt=""
            className="h-full w-full"
            decoding="async"
            height={192}
            loading="lazy"
            src={src}
            width={288}
          />
        ) : null}
      </div>
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-ds-display text-sm font-semibold">
            {catalogCase.title}
          </p>
          <p className="mt-0.5 font-ds-mono text-ds-mono-caps-xs uppercase opacity-45">
            {catalogCase.family}
          </p>
        </div>
        <ArrowUpRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 opacity-55 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </div>
      <Link
        to="/charts/catalog/charts/$caseId"
        params={{ caseId: catalogCase.id }}
        search={{}}
        preload={false}
        aria-label={`Open the ${catalogCase.title} catalog example`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] focus-visible:ring-offset-3 focus-visible:ring-offset-background-subtle"
      />
    </div>
  )
}

function compareCatalogCases(left: CatalogCase, right: CatalogCase) {
  return left.order - right.order
}

function useHeroLayout() {
  const [layout, setLayout] = React.useState({
    featuredLayout: false,
    visibleStandardTileCount: 1,
  })

  React.useEffect(() => {
    const medium = window.matchMedia('(min-width: 768px)')
    const large = window.matchMedia('(min-width: 1024px)')
    const extraLarge = window.matchMedia('(min-width: 1280px)')
    const updateLayout = () =>
      setLayout({
        featuredLayout: extraLarge.matches,
        visibleStandardTileCount: large.matches ? 3 : medium.matches ? 2 : 1,
      })

    updateLayout()
    medium.addEventListener('change', updateLayout)
    large.addEventListener('change', updateLayout)
    extraLarge.addEventListener('change', updateLayout)
    return () => {
      medium.removeEventListener('change', updateLayout)
      large.removeEventListener('change', updateLayout)
      extraLarge.removeEventListener('change', updateLayout)
    }
  }, [])

  return layout
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = React.useState(false)

  React.useEffect(() => {
    if (!window.matchMedia) return

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateReducedMotion = () => setReducedMotion(query.matches)
    updateReducedMotion()
    query.addEventListener('change', updateReducedMotion)
    return () => query.removeEventListener('change', updateReducedMotion)
  }, [])

  return reducedMotion
}
