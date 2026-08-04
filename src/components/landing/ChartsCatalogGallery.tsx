import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  PauseIcon,
  PlayIcon,
} from '@phosphor-icons/react'

import {
  ChartsCatalogChart,
  type ChartsCatalogModuleReference,
} from '~/components/charts/ChartsCatalogChart'
import { useInView } from '~/hooks/useInView'
import type { ChartsCatalogCase } from '~/utils/charts-catalog'

type CatalogCase = Pick<
  ChartsCatalogCase,
  'family' | 'id' | 'order' | 'title'
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

const heroIntervals = [2_700, 3_000, 3_300] as const
const heroTileClasses = ['', 'hidden md:block', 'hidden lg:block'] as const
const plotCropPreviewCaseIds = new Set([
  '04-stacked-time-area',
  '20-normalized-stacked-area',
  '21-streamgraph',
  '41-waffle-unit-chart',
  '61-quantile-ribbon',
])
export function CatalogChartsHero({
  catalog,
}: {
  catalog: ChartsLandingCatalog
}) {
  const rootRef = React.useRef<HTMLElement>(null)
  const orderedCases = React.useMemo(
    () => [...catalog.cases].sort(compareCatalogCases),
    [catalog.cases],
  )
  const [activeIndices, setActiveIndices] = React.useState(() =>
    heroIntervals.map((_, index) =>
      Math.floor((catalog.cases.length * index) / heroIntervals.length),
    ),
  )
  const [focused, setFocused] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const inView = useInView(rootRef, { threshold: 0.2 })
  const [pageVisible, setPageVisible] = React.useState(true)
  const [paused, setPaused] = React.useState(false)
  const reducedMotion = useReducedMotion()
  const visibleTileCount = useHeroTileCount()
  const running =
    !paused && !reducedMotion && !focused && !hovered && inView && pageVisible

  React.useEffect(() => {
    if (!running || orderedCases.length < 2) return

    const intervals = heroIntervals
      .slice(0, visibleTileCount)
      .map((intervalMs, tileIndex) =>
        window.setInterval(() => {
          setActiveIndices((indices) =>
            indices.map((index, indexToUpdate) =>
              indexToUpdate === tileIndex
                ? (index + 1) % orderedCases.length
                : index,
            ),
          )
        }, intervalMs),
      )

    return () => intervals.forEach((interval) => window.clearInterval(interval))
  }, [orderedCases.length, running, visibleTileCount])

  React.useEffect(() => {
    const updateVisibility = () =>
      setPageVisible(document.visibilityState === 'visible')
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () =>
      document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  if (!orderedCases[0]) return null

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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {heroIntervals.map((_, tileIndex) => {
          const activeCase =
            orderedCases[activeIndices[tileIndex] ?? 0] ?? orderedCases[0]

          return (
            <HeroChartTile
              key={tileIndex}
              artifactRevision={catalog.artifactRevision}
              catalogCase={activeCase}
              className={heroTileClasses[tileIndex]}
              enabled={tileIndex < visibleTileCount}
              theme={chartTheme((activeIndices[tileIndex] ?? 0) + tileIndex)}
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
              setActiveIndices((indices) =>
                indices.map((index) => (index + 1) % orderedCases.length),
              )
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
  catalogCase,
  className,
  enabled,
  theme,
}: {
  artifactRevision: string
  catalogCase: CatalogCase
  className: string
  enabled: boolean
  theme: 'dark' | 'light'
}) {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = React.useState(240)

  React.useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const updateHeight = () =>
      setChartHeight(
        Math.max(1, Math.floor(stage.getBoundingClientRect().height)),
      )
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  return (
    <figure className={`min-w-0 ${className}`}>
      <Link
        to="/charts/catalog/charts/$caseId"
        params={{ caseId: catalogCase.id }}
        search={{}}
        preload={false}
        aria-label={`Open the ${catalogCase.title} catalog example`}
        className="group relative block overflow-hidden rounded-2xl shadow-[0_24px_55px_-28px_rgb(3_18_25/0.58)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] focus-visible:ring-offset-4 focus-visible:ring-offset-background-default"
      >
        <div
          ref={stageRef}
          className={`relative h-[22rem] md:h-[19rem] lg:h-[17rem] xl:h-[18rem] charts-catalog-card-${theme}`}
        >
          {enabled ? (
            <div
              key={catalogCase.id}
              className="charts-catalog-hero-frame absolute inset-0"
            >
              <ChartsCatalogChart
                artifactRevision={artifactRevision}
                caseId={catalogCase.id}
                height={chartHeight}
                module={catalogCase.modules.tanstack}
              />
            </div>
          ) : null}
        </div>
        <ArrowUpRightIcon
          aria-hidden="true"
          className={`absolute right-4 top-4 size-5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none ${
            theme === 'dark' ? 'text-white/70' : 'text-[#071219]/60'
          }`}
        />
      </Link>

      <figcaption className="mt-2 min-w-0 px-1">
        <p
          key={catalogCase.id}
          className="charts-catalog-title-enter truncate font-ds-display text-sm font-semibold text-text-primary xl:text-base"
        >
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
}: {
  catalog: ChartsLandingCatalog
}) {
  const orderedCases = React.useMemo(
    () => [...catalog.cases].sort(compareCatalogCases),
    [catalog.cases],
  )

  return (
    <div className="fade-x fade-size-x-sm -mx-5 overflow-x-auto overscroll-x-contain px-5 pb-5 [scrollbar-color:rgb(var(--landing-glow)/0.48)_transparent] md:-mx-10 md:px-10 lg:-mx-12 lg:px-12 2xl:-mx-20 2xl:px-20">
      <div className="grid min-w-max snap-x snap-proximity grid-flow-col grid-rows-3 auto-cols-[min(74vw,18rem)] gap-3 sm:auto-cols-[18rem]">
        {orderedCases.map((catalogCase, index) => (
          <CatalogChartCard
            key={catalogCase.id}
            artifactRevision={catalog.artifactRevision}
            catalogCase={catalogCase}
            theme={chartTheme(index)}
          />
        ))}
      </div>
    </div>
  )
}

function CatalogChartCard({
  artifactRevision,
  catalogCase,
  theme,
}: {
  artifactRevision: string
  catalogCase: CatalogCase
  theme: 'dark' | 'light'
}) {
  const plotCropPreview = plotCropPreviewCaseIds.has(catalogCase.id)

  return (
    <Link
      to="/charts/catalog/charts/$caseId"
      params={{ caseId: catalogCase.id }}
      search={{}}
      preload={false}
      aria-label={`Open the ${catalogCase.title} catalog example`}
      className={`charts-catalog-gallery-card charts-catalog-card-${theme} group block snap-start overflow-hidden rounded-xl shadow-[0_16px_35px_-26px_rgb(3_18_25/0.65)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgb(3_18_25/0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] focus-visible:ring-offset-3 focus-visible:ring-offset-background-subtle motion-reduce:transition-none`}
    >
      <div className="relative h-44 overflow-hidden">
        <div
          className={`${
            plotCropPreview
              ? 'absolute -top-44 left-0 w-[150%] origin-top-left scale-[0.6666667]'
              : 'h-full w-full'
          }`}
        >
          <ChartsCatalogChart
            artifactRevision={artifactRevision}
            caseId={catalogCase.id}
            defer
            height={plotCropPreview ? 528 : 176}
            interactive={false}
            module={catalogCase.modules.tanstack}
          />
        </div>
      </div>
      <div
        className={`flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 ${
          theme === 'dark' ? 'text-white' : 'text-[#071219]'
        }`}
      >
        <div className="min-w-0">
          <p className="truncate font-ds-display text-sm font-semibold">
            {catalogCase.title}
          </p>
          <p
            className={`mt-0.5 font-ds-mono text-ds-mono-caps-xs uppercase ${
              theme === 'dark' ? 'text-white/45' : 'text-[#071219]/45'
            }`}
          >
            {catalogCase.family}
          </p>
        </div>
        <ArrowUpRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 opacity-55 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </div>
    </Link>
  )
}

function compareCatalogCases(left: CatalogCase, right: CatalogCase) {
  return left.order - right.order
}

function chartTheme(index: number): 'dark' | 'light' {
  return index % 4 === 1 || index % 4 === 2 ? 'dark' : 'light'
}

function useHeroTileCount() {
  const [tileCount, setTileCount] = React.useState(1)

  React.useEffect(() => {
    const medium = window.matchMedia('(min-width: 768px)')
    const large = window.matchMedia('(min-width: 1024px)')
    const updateTileCount = () =>
      setTileCount(large.matches ? 3 : medium.matches ? 2 : 1)

    updateTileCount()
    medium.addEventListener('change', updateTileCount)
    large.addEventListener('change', updateTileCount)
    return () => {
      medium.removeEventListener('change', updateTileCount)
      large.removeEventListener('change', updateTileCount)
    }
  }, [])

  return tileCount
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
