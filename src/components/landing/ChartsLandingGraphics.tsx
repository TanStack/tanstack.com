import * as React from 'react'
import { Pause, Play, Shuffle } from '@phosphor-icons/react'

import kineticAreaChartSource from '../../../scripts/charts-landing/kinetic-area-chart.ts?raw'
import kineticDumbbellChartSource from '../../../scripts/charts-landing/kinetic-dumbbell-chart.ts?raw'
import kineticLayeredChartSource from '../../../scripts/charts-landing/kinetic-layered-chart.ts?raw'
import kineticLineChartSource from '../../../scripts/charts-landing/kinetic-line-chart.ts?raw'
import kineticLollipopChartSource from '../../../scripts/charts-landing/kinetic-lollipop-chart.ts?raw'
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
  chartsThemeProductSvg,
  chartsThemeTerminalSvg,
} from './chartsCommonSvg'
import {
  chartsActivationCompactSvg,
  chartsActivationSvg,
} from './chartsActivationSvg'
import {
  chartsKineticAreaSvg,
  chartsKineticDumbbellSvg,
  chartsKineticLayeredSvg,
  chartsKineticLineSvg,
  chartsKineticLollipopSvg,
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

const kineticLollipopTooltip = {
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

const kineticDumbbellTooltip = {
  format: (points) => {
    const point = firstPoint(points)
    const comparison = point.elementKey.startsWith('hero-secondary:')
    return {
      rows: [
        {
          label: comparison ? 'Previous' : 'Current',
          value: Math.round(asNumber(point.xValue)).toLocaleString(),
        },
      ],
      title: String(point.yValue),
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

const themeTooltip = {
  format: (points) => {
    const point = firstPoint(points)
    return {
      rows: [
        {
          label: 'Active teams',
          value: Math.round(asNumber(point.yValue)).toLocaleString(),
        },
      ],
      title: `Month ${Math.round(asNumber(point.xValue))}`,
    }
  },
  mode: 'x',
  theme: 'light',
} satisfies LandingChartTooltipConfig

const terminalThemeTooltip = {
  ...themeTooltip,
  theme: 'dark',
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
        color: '#61adbf',
        label: 'Activation',
        value: `${Math.round(asNumber(activation.yValue))}%`,
      },
      {
        color: '#e06e49',
        label: 'Goal',
        value: '70%',
      },
    ]
    if (release) {
      const slug =
        release.elementKey.match(/:string:([^:]+)$/)?.[1] ?? 'Release'
      rows.push({
        color: '#eeebd4',
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
  theme: 'dark',
} satisfies LandingChartTooltipConfig

const kineticCharts = [
  {
    code: extractChartDefinition(kineticLayeredChartSource),
    data: 'productSignals · 8 rows',
    id: 'layers',
    marks: 'areaY + ruleY + lineY + dot + text',
    scales: 'linear × linear',
    svg: chartsKineticLayeredSvg,
    tooltip: kineticTrendTooltip,
  },
  {
    code: extractChartDefinition(kineticLineChartSource),
    data: 'productSignals · 8 rows',
    id: 'line',
    marks: 'lineY + dot',
    scales: 'linear × linear',
    svg: chartsKineticLineSvg,
    tooltip: kineticTrendTooltip,
  },
  {
    code: extractChartDefinition(kineticAreaChartSource),
    data: 'productSignals · 8 rows',
    id: 'area',
    marks: 'areaY + lineY + dot',
    scales: 'linear × linear',
    svg: chartsKineticAreaSvg,
    tooltip: kineticTrendTooltip,
  },
  {
    code: extractChartDefinition(kineticScatterChartSource),
    data: 'productSignals · 8 rows',
    id: 'scatter',
    marks: 'dot',
    scales: 'linear × linear',
    svg: chartsKineticScatterSvg,
    tooltip: kineticScatterTooltip,
  },
  {
    code: extractChartDefinition(kineticLollipopChartSource),
    data: 'productSignals · 8 rows',
    id: 'lollipop',
    marks: 'link + dot',
    scales: 'band × linear',
    svg: chartsKineticLollipopSvg,
    tooltip: kineticLollipopTooltip,
  },
  {
    code: extractChartDefinition(kineticDumbbellChartSource),
    data: 'productSignals · 8 rows',
    id: 'dumbbell',
    marks: 'link + dot + dot',
    scales: 'linear × band',
    svg: chartsKineticDumbbellSvg,
    tooltip: kineticDumbbellTooltip,
  },
] as const

const themePreviews = [
  {
    className: 'bg-[#efe7d8] text-[#211d18]',
    label: 'Editorial',
    svg: chartsThemeEditorialSvg,
    tooltip: themeTooltip,
  },
  {
    className: 'bg-[#eff6ff] text-[#172554]',
    label: 'Product',
    svg: chartsThemeProductSvg,
    tooltip: themeTooltip,
  },
  {
    className: 'bg-[#03110a] text-[#bbf7d0]',
    label: 'Terminal',
    svg: chartsThemeTerminalSvg,
    tooltip: terminalThemeTooltip,
  },
] as const

const bundleComparisonRows = [
  {
    color: '#61adbf',
    kind: 'suite',
    label: 'TanStack Charts',
    maximum: 32.08,
    minimum: 26.58,
  },
  {
    displayValue: '49 KB',
    kind: 'snapshot',
    label: 'visx',
    value: 49,
  },
  {
    color: '#d8a84e',
    kind: 'suite',
    label: 'Chart.js',
    maximum: 58.21,
    minimum: 44.7,
  },
  {
    displayValue: '60 KB',
    kind: 'snapshot',
    label: 'Lightweight Charts',
    value: 60,
  },
  {
    displayValue: '87 KB',
    kind: 'snapshot',
    label: 'Vega-Lite',
    value: 87,
  },
  {
    color: '#b89ec7',
    kind: 'suite',
    label: 'Observable Plot',
    maximum: 91.94,
    minimum: 83.34,
  },
  {
    displayValue: '90 KB',
    kind: 'snapshot',
    label: 'D3',
    value: 90,
  },
  {
    displayValue: '100 KB',
    kind: 'snapshot',
    label: 'Highcharts',
    value: 100,
  },
  {
    displayValue: '105 KB',
    kind: 'snapshot',
    label: 'Victory',
    value: 105,
  },
  {
    displayValue: '143 KB',
    kind: 'snapshot',
    label: 'Nivo',
    value: 143,
  },
  {
    color: '#d98769',
    kind: 'suite',
    label: 'Recharts',
    maximum: 168.27,
    minimum: 153.08,
  },
  {
    color: '#7eaa88',
    kind: 'suite',
    label: 'Apache ECharts',
    maximum: 173.18,
    minimum: 153.1,
  },
  {
    displayValue: '164 KB',
    kind: 'snapshot',
    label: 'ApexCharts',
    value: 164,
  },
  {
    displayValue: '~250 kB partial',
    kind: 'snapshot',
    label: 'Plotly.js',
    value: 250,
  },
  {
    displayValue: '367 KB',
    kind: 'snapshot',
    label: 'AG Charts',
    value: 367,
  },
] as const

const kineticChartIntervalMs = 4_000
const kineticChartTransitionMs = 1_200
const bundleChartMaximumKb = 400

export function KineticChartsHero() {
  const rootRef = React.useRef<HTMLElement>(null)
  const activeIndexRef = React.useRef(0)
  const transitionTimeoutRef = React.useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [outgoingIndex, setOutgoingIndex] = React.useState<number | null>(null)
  const [focusWithin, setFocusWithin] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const [inView, setInView] = React.useState(true)
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
    const root = rootRef.current
    if (!root || !('IntersectionObserver' in window)) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.18 },
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

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
      className="library-landing-graphic min-w-0 overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.45)] bg-background-surface shadow-[0_24px_70px_-28px_rgb(var(--landing-glow)/0.45)]"
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
      <figcaption className="flex min-w-0 flex-col gap-4 border-b border-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <dl
          key={activeChart.id}
          className="charts-kinetic-meta-enter flex min-w-0 flex-wrap gap-x-5 gap-y-2"
        >
          <GrammarValue label="Data" value={activeChart.data} />
          <GrammarValue label="Marks" value={activeChart.marks} />
          <GrammarValue label="Scales" value={activeChart.scales} />
        </dl>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border-default bg-background-subtle px-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/65 transition-colors hover:border-[var(--landing-accent)] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
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
              <Pause aria-hidden="true" className="size-3" />
            ) : (
              <Play aria-hidden="true" className="size-3" />
            )}
            {autoPlay ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border-default bg-background-subtle px-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/65 transition-colors hover:border-[var(--landing-accent)] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
            onClick={showNewVariation}
          >
            <Shuffle aria-hidden="true" className="size-3" />
            New variation
          </button>
        </div>
      </figcaption>

      <div className="grid min-w-0 sm:h-[30rem] sm:grid-cols-[minmax(0,0.85fr)_minmax(19rem,1.15fr)] lg:h-[clamp(28rem,38vw,34rem)]">
        <div className="relative aspect-[23/13] min-w-0 overflow-hidden border-b border-white/10 bg-[#081625] p-3 sm:aspect-auto sm:h-full sm:border-b-0 sm:border-r sm:p-5">
          <ChartsKineticMorph
            current={activeChart}
            previous={outgoingChart}
            reducedMotion={reducedMotion}
          />
        </div>

        <div className="relative h-[22rem] min-w-0 overflow-hidden bg-[#050a12] sm:h-full">
          <ChartsKineticCode
            currentSource={activeChart.code}
            previousSource={outgoingChart?.code}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>
    </figure>
  )
}

function GrammarValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <dt className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
        {label}
      </dt>
      <dd className="truncate font-ds-mono text-ds-mono-2xs text-text-primary/55">
        {value}
      </dd>
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
              Example account dataset · Q2 2026
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
    <div className="fade-x fade-size-x-sm -mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-auto md:max-w-[54rem] md:overflow-visible md:px-0 md:fade-none-x">
      <div className="grid min-w-max grid-flow-col auto-cols-[18rem] gap-3 md:min-w-0 md:grid-flow-row md:auto-cols-auto md:grid-cols-3">
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
            <RendererGraphic
              className="mt-2 aspect-[520/320] w-full"
              svg={preview.svg}
              tooltip={preview.tooltip}
            />
          </figure>
        ))}
      </div>
    </div>
  )
}

export function BundleSizeFigure() {
  return (
    <figure
      aria-label="Gzip bundle sizes across controlled cold-page consumers and external main-export snapshots"
      aria-roledescription="chart"
      className="relative overflow-hidden rounded-xl border border-border-subtle bg-background-surface p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <p className="font-ds-display text-ds-heading-5 text-text-primary">
            Gzip bundle comparison
          </p>
          <p className="mt-1 text-ds-body-xs text-text-primary/45">
            Controlled cold-page ranges and main-export snapshots*
          </p>
        </div>
      </div>

      <ol className="mt-6 space-y-4">
        {bundleComparisonRows.map((row) => {
          const color = row.kind === 'suite' ? row.color : '#8f887d'
          const maximum = row.kind === 'suite' ? row.maximum : row.value

          return (
            <li
              key={row.label}
              aria-label={
                row.kind === 'suite'
                  ? `${row.label}: ${row.minimum.toFixed(2)} to ${row.maximum.toFixed(2)} kibibytes gzip in the controlled cold-page suite`
                  : `${row.label}: ${row.displayValue} gzip, external main-export snapshot`
              }
            >
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <span
                  className={`text-ds-label-sm ${
                    row.label === 'TanStack Charts'
                      ? 'text-text-primary'
                      : 'text-text-secondary'
                  }`}
                >
                  {row.label}
                  {row.kind === 'snapshot' ? '*' : null}
                </span>
                <span className="shrink-0 font-ds-mono text-ds-mono-xs text-text-primary">
                  {row.kind === 'suite'
                    ? `${row.minimum.toFixed(2)}–${row.maximum.toFixed(2)} KiB`
                    : row.displayValue}
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-background-subtle">
                <span
                  className="absolute inset-y-0 left-0 rounded-full opacity-20"
                  style={{
                    backgroundColor: color,
                    width: `${(maximum / bundleChartMaximumKb) * 100}%`,
                  }}
                />
                {row.kind === 'suite' ? (
                  <span
                    className="absolute inset-y-0 rounded-full"
                    style={{
                      backgroundColor: color,
                      left: `${(row.minimum / bundleChartMaximumKb) * 100}%`,
                      width: `${
                        ((row.maximum - row.minimum) / bundleChartMaximumKb) *
                        100
                      }%`,
                    }}
                  />
                ) : (
                  <span
                    className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full"
                    style={{
                      backgroundColor: color,
                      left: `${(row.value / bundleChartMaximumKb) * 100}%`,
                    }}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-3 grid grid-cols-5 font-ds-mono text-ds-mono-2xs text-text-primary/35">
        <span>0</span>
        <span className="text-center">100</span>
        <span className="text-center">200</span>
        <span className="text-center">300</span>
        <span className="text-right">400 KB</span>
      </div>

      <figcaption className="mt-6 space-y-2 border-t border-border-subtle pt-4 text-ds-body-xs text-text-muted">
        <p>
          Controlled ranges use the{' '}
          <a
            href="https://github.com/TanStack/charts/blob/v0.3.1/benchmarks/comparison/bundle-baseline.json"
            className="text-[var(--landing-accent-bright)] underline decoration-current/30 underline-offset-4 hover:decoration-current"
          >
            tracked v0.3.1 baseline
          </a>{' '}
          of full cold-page bundles with pinned package versions.
        </p>
        <p>
          * Main-export snapshots use different methodology; modular imports can
          be smaller. visx is @visx/xychart. Vega-Lite excludes the Vega
          runtime. Plotly.js shows its partial build; the full build is ~3.6 MB
          min+gzip.{' '}
          <a
            href="/charts/latest/docs/comparison"
            className="text-[var(--landing-accent-bright)] underline decoration-current/30 underline-offset-4 hover:decoration-current"
          >
            Sources and caveats
          </a>
          .
        </p>
      </figcaption>
    </figure>
  )
}

export function ActivationChart() {
  return (
    <figure className="min-w-0 bg-[#0b1728]">
      <figcaption className="border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-ds-display text-ds-heading-5 text-white">
              Weekly activation rate
            </p>
            <p className="mt-1 font-ds-mono text-ds-mono-caps-xs uppercase text-white/45">
              Jan–May 2026 · illustrative product telemetry
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-ds-display text-ds-heading-3 text-white">78%</p>
            <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-status-success">
              above 70% goal
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-ds-mono text-ds-mono-caps-xs uppercase text-white/45">
          <LegendItem color="bg-[#61adbf]" label="Activation" />
          <LegendItem color="bg-[#3aa3c4]/45" label="Expected range" />
          <LegendItem color="bg-[#e06e49]" label="Goal" />
          <LegendItem
            color="bg-[#eeebd4] ring-1 ring-[#61adbf]"
            label="Releases"
          />
        </div>
      </figcaption>

      <ResponsiveGraphic
        className="charts-activation-graphic aspect-[520/560] w-full sm:aspect-[1200/620]"
        compactSvg={chartsActivationCompactSvg}
        svg={chartsActivationSvg}
        tooltip={activationTooltip}
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
