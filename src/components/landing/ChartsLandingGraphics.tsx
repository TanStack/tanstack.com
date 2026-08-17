import * as React from 'react'
import { PauseIcon } from '@phosphor-icons/react/Pause'
import { PlayIcon } from '@phosphor-icons/react/Play'
import { ShuffleIcon } from '@phosphor-icons/react/Shuffle'

import { useIsDark } from '~/hooks/useIsDark'
import { useInView } from '~/hooks/useInView'

import kineticBarChartSource from '../../../scripts/charts-landing/kinetic-bar-chart.ts?raw'
import kineticDonutChartSource from '../../../scripts/charts-landing/kinetic-donut-chart.ts?raw'
import kineticHeatmapChartSource from '../../../scripts/charts-landing/kinetic-heatmap-chart.ts?raw'
import kineticLayeredChartSource from '../../../scripts/charts-landing/kinetic-layered-chart.ts?raw'
import kineticRadarChartSource from '../../../scripts/charts-landing/kinetic-radar-chart.ts?raw'
import kineticScatterChartSource from '../../../scripts/charts-landing/kinetic-scatter-chart.ts?raw'
import { ChartsKineticCode } from './ChartsKineticCode'
import { ChartsKineticMorph } from './ChartsKineticMorph'
import {
  LandingChartGraphic,
  type LandingChartTooltipConfig,
  type LandingChartTooltipPoint,
} from './ChartsLandingTooltip'
import {
  chartsThemeEditorialSvg,
  chartsThemeMonokaiSvg,
  chartsThemeProductSvg,
  chartsThemeTerminalSvg,
} from './chartsCommonSvg'
import {
  chartsActivationCompactSvg,
  chartsActivationSvg,
} from './chartsActivationSvg'
import {
  chartsKineticBarSvg,
  chartsKineticDonutSvg,
  chartsKineticHeatmapSvg,
  chartsKineticLayeredSvg,
  chartsKineticRadarSvg,
  chartsKineticScatterSvg,
} from './chartsKineticSvg'
import { chartsAccountsCompactSvg, chartsAccountsSvg } from './chartsHeroSvg'

const landingDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
})
const millisecondsPerDay = 86_400_000

const kineticTrendTooltip = {
  format: (points) => {
    const point = firstPoint(points)
    return {
      rows: [
        {
          label: 'Signal',
          value: Math.round(asNumber(point.yValue)).toLocaleString(),
        },
      ],
      title: `M${Math.round(asNumber(point.xValue))}`,
    }
  },
  initialPoint: 'first',
  mode: 'x',
  theme: 'dark',
} satisfies LandingChartTooltipConfig

const kineticScatterTooltip = {
  format: (points) => {
    const point = firstPoint(points)
    return {
      rows: [
        {
          label: 'Effort',
          value: `${Math.round(asNumber(point.xValue))} days`,
        },
        {
          label: 'Impact',
          value: `${Math.round(asNumber(point.yValue))}%`,
        },
      ],
      title: productFromPoint(point),
    }
  },
  initialPoint: 'first',
  theme: 'dark',
} satisfies LandingChartTooltipConfig

const kineticBarTooltip = {
  format: (points) => {
    const point = firstPoint(points)
    return {
      rows: [
        {
          label: 'Signal',
          value: Math.round(asNumber(point.yValue)).toLocaleString(),
        },
      ],
      title: String(point.xValue),
    }
  },
  initialPoint: 'first',
  theme: 'dark',
} satisfies LandingChartTooltipConfig

const kineticHeatmapTooltip = {
  format: (points) => {
    const point = firstPoint(points)
    return {
      rows: [
        {
          label: 'Dimension',
          value: String(point.yValue),
        },
      ],
      title: String(point.xValue),
    }
  },
  initialPoint: 'first',
  theme: 'dark',
} satisfies LandingChartTooltipConfig

const kineticRadarTooltip = {
  format: (points) => {
    const point = firstPoint(points)
    return {
      rows: [
        {
          label: 'Score',
          value: `${Math.round(asNumber(point.yValue))}%`,
        },
      ],
      title: String(point.xValue),
    }
  },
  initialPoint: 'first',
  theme: 'dark',
} satisfies LandingChartTooltipConfig

const productShare = new Map([
  ['Core', '31%'],
  ['Data', '25%'],
  ['Other', '11%'],
  ['Runtime', '19%'],
  ['UI', '14%'],
])

const kineticDonutTooltip = {
  format: (points) => {
    const point = firstPoint(points)
    const segment = point.elementKey.match(/:string:([^:]+)$/)?.[1] ?? 'Segment'
    return {
      rows: [
        {
          label: 'Share',
          value: productShare.get(segment) ?? '—',
        },
      ],
      title: segment,
    }
  },
  initialPoint: 'first',
  theme: 'dark',
} satisfies LandingChartTooltipConfig

const accountTooltip = {
  format: (points) => {
    const point = firstPoint(points)
    const match = point.elementKey.match(/^accounts-([^:]+):.*:string:([^:]+)$/)
    const segment = match?.[1] ? titleCase(match[1]) : 'Account'
    const account = match?.[2] ? titleCase(match[2]) : 'Account'
    return {
      kicker: segment,
      rows: [
        {
          label: 'Monthly revenue',
          value: `$${Math.round(asNumber(point.xValue))}k`,
        },
        {
          label: '90-day retention',
          value: `${Math.round(asNumber(point.yValue) * 100)}%`,
        },
      ],
      title: account,
    }
  },
  theme: 'light',
} satisfies LandingChartTooltipConfig

const activationTooltip = {
  format: (points) => {
    const activation =
      points.find((point) => point.elementKey.startsWith('activation-line:')) ??
      firstPoint(points)
    const release = points.find((point) =>
      point.elementKey.startsWith('activation-events:'),
    )
    const rows = [
      {
        color: 'var(--activation-line)',
        label: 'Activation',
        value: `${Math.round(asNumber(activation.yValue))}%`,
      },
      {
        color: 'var(--activation-goal)',
        label: 'Goal',
        value: '70%',
      },
    ]
    if (release) {
      const slug =
        release.elementKey.match(/:string:([^:]+)$/)?.[1] ?? 'Release'
      rows.push({
        color: 'var(--activation-release)',
        label: 'Release',
        value: titleCase(slug),
      })
    }
    return {
      kicker: 'Week ending',
      rows,
      title: landingDateFormatter.format(dateFromPoint(activation)),
    }
  },
  mode: 'x',
} satisfies LandingChartTooltipConfig

const kineticCharts = [
  {
    code: extractChartDefinition(kineticLayeredChartSource),
    data: 'productSignals · 8 rows',
    id: 'composed',
    label: 'Composed',
    legend: [
      { color: 'bg-[#61e8ff]', label: 'Core' },
      { color: 'bg-[#ff806f]', label: 'Data' },
      { color: 'bg-[#b9f227]', label: 'Runtime' },
    ],
    scales: 'linear × linear',
    svg: chartsKineticLayeredSvg,
    tooltip: kineticTrendTooltip,
  },
  {
    code: extractChartDefinition(kineticBarChartSource),
    data: 'productSignals · 8 rows',
    id: 'bars',
    label: 'Bars',
    legend: [
      { color: 'bg-[#61e8ff]', label: 'Core' },
      { color: 'bg-[#ff806f]', label: 'Data' },
      { color: 'bg-[#b9f227]', label: 'Runtime' },
    ],
    scales: 'band × linear',
    svg: chartsKineticBarSvg,
    tooltip: kineticBarTooltip,
  },
  {
    code: extractChartDefinition(kineticHeatmapChartSource),
    data: 'heatmapSignals · 32 rows',
    id: 'heatmap',
    label: 'Heatmap',
    legend: [],
    scales: 'band × band',
    svg: chartsKineticHeatmapSvg,
    tooltip: kineticHeatmapTooltip,
  },
  {
    code: extractChartDefinition(kineticScatterChartSource),
    data: 'productSignals · 8 rows',
    id: 'bubble',
    label: 'Bubble',
    legend: [
      { color: 'bg-[#61e8ff]', label: 'Core' },
      { color: 'bg-[#ff806f]', label: 'Data' },
      { color: 'bg-[#b9f227]', label: 'Runtime' },
    ],
    scales: 'linear × linear',
    svg: chartsKineticScatterSvg,
    tooltip: kineticScatterTooltip,
  },
  {
    code: extractChartDefinition(kineticRadarChartSource),
    data: 'radarDimensions · 6 rows',
    id: 'radar',
    label: 'Radar',
    legend: [],
    scales: 'point × linear',
    svg: chartsKineticRadarSvg,
    tooltip: kineticRadarTooltip,
  },
  {
    code: extractChartDefinition(kineticDonutChartSource),
    data: 'productShare · 5 rows',
    id: 'donut',
    label: 'Donut',
    legend: [
      { color: 'bg-[#61e8ff]', label: 'Core' },
      { color: 'bg-[#ff806f]', label: 'Data' },
      { color: 'bg-[#b9f227]', label: 'Runtime' },
      { color: 'bg-[#a78bfa]', label: 'UI' },
      { color: 'bg-[#77929f]', label: 'Other' },
    ],
    scales: 'angle × radius',
    svg: chartsKineticDonutSvg,
    tooltip: kineticDonutTooltip,
  },
] as const

const themePreviews = [
  {
    className: 'bg-[#efe7d8] text-[#211d18]',
    label: 'Editorial',
    svg: chartsThemeEditorialSvg,
  },
  {
    className: 'bg-[#eff6ff] text-[#172554]',
    label: 'Product',
    svg: chartsThemeProductSvg,
  },
  {
    className: 'bg-[#03110a] text-[#bbf7d0]',
    label: 'Terminal',
    svg: chartsThemeTerminalSvg,
  },
  {
    className: 'bg-[#272822] text-[#f8f8f2]',
    label: 'Monokai',
    svg: chartsThemeMonokaiSvg,
  },
] as const

const kineticChartIntervalMs = 4_000
const kineticChartTransitionMs = 1_200

export function KineticChartsHero() {
  const rootRef = React.useRef<HTMLElement>(null)
  const activeIndexRef = React.useRef(0)
  const transitionTimeoutRef = React.useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [outgoingIndex, setOutgoingIndex] = React.useState<number | null>(null)
  const [focusWithin, setFocusWithin] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const inView = useInView(rootRef, { threshold: 0.18 })
  const [autoAdvanceOverride, setAutoAdvanceOverride] = React.useState(false)
  const [pageVisible, setPageVisible] = React.useState(true)
  const [paused, setPaused] = React.useState(false)
  const reducedMotion = useReducedMotion()
  const activeChart = kineticCharts[activeIndex] ?? kineticCharts[0]
  const outgoingChart =
    outgoingIndex === null ? undefined : kineticCharts[outgoingIndex]
  const interacting = focusWithin || hovered
  const autoPlay =
    !paused && (!reducedMotion || autoAdvanceOverride) && inView && pageVisible

  const showChart = React.useCallback(
    (nextIndex: number) => {
      const currentIndex = activeIndexRef.current
      if (nextIndex === currentIndex) {
        return
      }

      if (transitionTimeoutRef.current !== null) {
        return
      }

      if (reducedMotion) {
        setOutgoingIndex(null)
      } else {
        setOutgoingIndex(currentIndex)
        transitionTimeoutRef.current = window.setTimeout(() => {
          setOutgoingIndex(null)
          transitionTimeoutRef.current = null
        }, kineticChartTransitionMs)
      }

      activeIndexRef.current = nextIndex
      setActiveIndex(nextIndex)
    },
    [reducedMotion],
  )

  const showNewVariation = React.useCallback(() => {
    if (kineticCharts.length < 2) {
      return
    }

    const currentIndex = activeIndexRef.current
    const candidate = Math.floor(Math.random() * (kineticCharts.length - 1))
    showChart(candidate >= currentIndex ? candidate + 1 : candidate)
  }, [showChart])

  React.useEffect(() => {
    if (!autoPlay || interacting) {
      return
    }

    const interval = window.setInterval(
      showNewVariation,
      kineticChartIntervalMs,
    )
    return () => window.clearInterval(interval)
  }, [autoPlay, interacting, showNewVariation])

  React.useEffect(() => {
    const updateVisibility = () =>
      setPageVisible(document.visibilityState === 'visible')
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () =>
      document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  React.useEffect(
    () => () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current)
      }
    },
    [],
  )

  return (
    <figure
      ref={rootRef}
      className="library-landing-graphic charts-kinetic-hero min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-[#050a12] text-white shadow-[0_36px_90px_-32px_rgb(var(--landing-glow)/0.7)]"
      onBlurCapture={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setFocusWithin(false)
        }
      }}
      onFocusCapture={() => setFocusWithin(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <figcaption className="border-b border-white/10 bg-[#07101b] px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inset-0 rounded-full bg-[#b9f227] opacity-45 blur-[3px]" />
              <span className="relative size-2.5 rounded-full bg-[#b9f227]" />
            </span>
            <p
              key={activeChart.id}
              aria-live="polite"
              className="charts-kinetic-meta-enter truncate font-ds-display text-ds-heading-6 text-white"
            >
              {activeChart.label}
            </p>
            <span className="shrink-0 font-ds-mono text-ds-mono-2xs text-white/35">
              {String(activeIndex + 1).padStart(2, '0')} /{' '}
              {String(kineticCharts.length).padStart(2, '0')}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={
                autoPlay ? 'Pause chart variations' : 'Play chart variations'
              }
              className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition-[color,background-color,border-color] duration-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#61e8ff]"
              onClick={() => {
                if (reducedMotion && !autoAdvanceOverride) {
                  setAutoAdvanceOverride(true)
                  setPaused(false)
                  return
                }
                setPaused((value) => !value)
              }}
            >
              {autoPlay ? (
                <PauseIcon aria-hidden="true" className="size-3.5" />
              ) : (
                <PlayIcon aria-hidden="true" className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 font-ds-mono text-ds-mono-caps-xs uppercase text-white/60 transition-[color,background-color,border-color] duration-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#61e8ff]"
              onClick={showNewVariation}
            >
              <ShuffleIcon aria-hidden="true" className="size-3.5" />
              <span className="hidden sm:inline">New variation</span>
            </button>
          </div>
        </div>

        <div className="fade-x fade-size-x-sm -mx-3 mt-3 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
          <div className="flex min-w-max gap-0.5 sm:gap-1">
            {kineticCharts.map((chart, index) => (
              <button
                key={chart.id}
                type="button"
                aria-pressed={index === activeIndex}
                className="rounded-md px-2 py-1.5 font-ds-mono text-ds-mono-2xs uppercase text-white/35 transition-[color,background-color] duration-200 hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#61e8ff] aria-pressed:bg-white/10 aria-pressed:text-white sm:px-2.5 sm:text-ds-mono-caps-xs"
                onClick={() => showChart(index)}
              >
                {chart.label}
              </button>
            ))}
          </div>
        </div>
      </figcaption>

      <div className="grid min-w-0 grid-rows-[minmax(19rem,1.35fr)_minmax(17rem,0.65fr)] sm:h-[38rem] sm:grid-rows-[minmax(0,1.28fr)_minmax(0,0.72fr)] xl:h-[42rem]">
        <div className="charts-kinetic-stage relative min-w-0 overflow-hidden border-b border-white/10 p-4 sm:p-7">
          {activeChart.legend.length ? (
            <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-[#07111e]/75 px-3 py-2 font-ds-mono text-ds-mono-caps-xs uppercase text-white/45 backdrop-blur-md sm:bottom-6 sm:left-6">
              {activeChart.legend.map((item) => (
                <LegendItem
                  key={item.label}
                  color={`rounded-full ${item.color}`}
                  label={item.label}
                />
              ))}
            </div>
          ) : null}

          <ChartsKineticMorph
            current={activeChart}
            previous={outgoingChart}
            reducedMotion={reducedMotion}
          />
        </div>

        <div className="relative min-h-0 min-w-0 overflow-hidden bg-[#05080d]">
          <div className="absolute inset-x-0 top-0 z-20 flex h-10 items-center justify-between border-b border-white/10 bg-[#080d14]/90 px-4 font-ds-mono text-ds-mono-caps-xs uppercase backdrop-blur-md sm:px-5">
            <div className="flex min-w-0 items-center gap-4">
              <span className="shrink-0 text-white/65">chart.ts</span>
              <div className="hidden min-w-0 sm:block">
                <GrammarValue label="Data" value={activeChart.data} />
              </div>
            </div>
            <GrammarValue label="Scales" value={activeChart.scales} />
          </div>
          <div className="absolute inset-0 pt-10">
            <ChartsKineticCode
              currentSource={activeChart.code}
              previousSource={outgoingChart?.code}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>
      </div>
    </figure>
  )
}

function GrammarValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-[#61e8ff]">
        {label}
      </span>
      <span className="truncate font-ds-mono text-ds-mono-2xs text-white/45">
        {value}
      </span>
    </div>
  )
}

export function AccountChart() {
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-border-subtle bg-background-surface">
      <figcaption className="border-b border-border-subtle px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-ds-display text-ds-heading-5 text-text-primary">
              Account health
            </p>
            <p className="mt-1 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/40">
              Illustrative account dataset
            </p>
          </div>
          <p className="max-w-xs text-ds-body-xs text-text-secondary">
            Which high-revenue accounts need retention attention?
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/45">
          <LegendItem color="bg-[#39af46]" label="Enterprise" />
          <LegendItem color="bg-[#e06e49]" label="Growth" />
          <LegendItem color="bg-[#3aa3c4]" label="SMB" />
          <span className="border-l border-border-default pl-4">
            Bubble size = seats
          </span>
        </div>
      </figcaption>

      <ResponsiveGraphic
        className="aspect-[520/560] w-full bg-[#fdfdfd] sm:aspect-[900/560]"
        compactSvg={chartsAccountsCompactSvg}
        svg={chartsAccountsSvg}
        tooltip={accountTooltip}
      />
    </figure>
  )
}

export function ThemeGallery() {
  return (
    <div className="fade-x fade-size-x-sm -mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-auto md:max-w-[72rem] md:overflow-visible md:px-0 md:fade-none-x">
      <div className="grid min-w-max grid-flow-col auto-cols-[18rem] gap-3 md:min-w-0 md:grid-flow-row md:auto-cols-auto md:grid-cols-4">
        {themePreviews.map((preview) => (
          <figure
            key={preview.label}
            className={`${preview.className} min-w-0 overflow-hidden rounded-xl border border-border-subtle p-3 md:p-4`}
          >
            <figcaption>
              <p className="font-ds-display text-ds-heading-6">
                {preview.label}
              </p>
            </figcaption>
            <StaticGraphic
              className="mt-2 aspect-[520/320] w-full"
              svg={preview.svg}
            />
          </figure>
        ))}
      </div>
    </div>
  )
}

export function ActivationChart() {
  const isDark = useIsDark()
  const tooltip = React.useMemo(
    () => ({ ...activationTooltip, theme: isDark ? 'dark' : 'light' }) as const,
    [isDark],
  )

  return (
    <figure className="charts-activation min-w-0 bg-[var(--activation-bg)] text-[var(--activation-foreground)]">
      <figcaption className="border-b border-[var(--activation-border)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-ds-display text-ds-heading-5">
              Weekly activation rate
            </p>
            <p className="mt-1 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--activation-muted)]">
              Illustrative product telemetry
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-ds-display text-ds-heading-3">78%</p>
            <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--activation-line)]">
              above 70% goal
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--activation-muted)]">
          <LegendItem color="bg-[var(--activation-line)]" label="Activation" />
          <LegendItem
            color="bg-[var(--activation-range)]"
            label="Expected range"
          />
          <LegendItem color="bg-[var(--activation-goal)]" label="Goal" />
          <LegendItem
            color="bg-[var(--activation-bg)] ring-1 ring-[var(--activation-release)]"
            label="Releases"
          />
        </div>
      </figcaption>

      <ResponsiveGraphic
        className="charts-activation-graphic aspect-[520/560] w-full sm:aspect-[1200/620]"
        compactSvg={chartsActivationCompactSvg}
        svg={chartsActivationSvg}
        tooltip={tooltip}
      />
    </figure>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 ${color}`} />
      {label}
    </span>
  )
}

function ResponsiveGraphic({
  className,
  compactSvg,
  svg,
  tooltip,
}: {
  className: string
  compactSvg: string
  svg: string
  tooltip: LandingChartTooltipConfig
}) {
  return (
    <div className={className}>
      <RendererGraphic
        className="h-full w-full sm:hidden"
        svg={compactSvg}
        tooltip={tooltip}
      />
      <RendererGraphic
        className="hidden h-full w-full sm:block"
        svg={svg}
        tooltip={tooltip}
      />
    </div>
  )
}

function RendererGraphic({
  className,
  svg,
  tooltip,
}: {
  className: string
  svg: string
  tooltip: LandingChartTooltipConfig
}) {
  return (
    <LandingChartGraphic className={className} svg={svg} tooltip={tooltip} />
  )
}

function StaticGraphic({ className, svg }: { className: string; svg: string }) {
  const staticSvg = React.useMemo(
    () => svg.replace('tabindex="0"', 'tabindex="-1"'),
    [svg],
  )

  return (
    <div
      className={`${className} pointer-events-none [&_svg]:h-full [&_svg]:w-full`}
      dangerouslySetInnerHTML={{ __html: staticSvg }}
    />
  )
}

function firstPoint(
  points: ReadonlyArray<LandingChartTooltipPoint>,
): LandingChartTooltipPoint {
  const point = points[0]
  if (!point) {
    throw new TypeError('Expected at least one chart tooltip point')
  }
  return point
}

function asNumber(value: number | string) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

function extractChartDefinition(source: string) {
  const exportedDefinition = source.search(/^export const /m)
  const localDefinition = source.search(/^const /m)
  const start =
    localDefinition >= 0 &&
    (exportedDefinition < 0 || localDefinition < exportedDefinition)
      ? localDefinition
      : exportedDefinition
  return (start >= 0 ? source.slice(start) : source).trim()
}

function productFromPoint(point: LandingChartTooltipPoint) {
  const encoded = point.elementKey.match(/:string:([^:]+)$/)?.[1]
  return encoded ? titleCase(encoded) : 'Product'
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = React.useState(false)

  React.useEffect(() => {
    if (!window.matchMedia) {
      return
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateReducedMotion = () => setReducedMotion(query.matches)
    updateReducedMotion()
    query.addEventListener('change', updateReducedMotion)
    return () => query.removeEventListener('change', updateReducedMotion)
  }, [])

  return reducedMotion
}

function titleCase(value: string) {
  return value
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function dateFromPoint(point: LandingChartTooltipPoint) {
  const encodedDate = point.elementKey.match(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/,
  )?.[1]
  if (encodedDate) {
    return new Date(encodedDate)
  }

  return new Date(
    Math.round(asNumber(point.xValue) / millisecondsPerDay) *
      millisecondsPerDay,
  )
}
