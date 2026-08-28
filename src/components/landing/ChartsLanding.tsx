import { ArrowRightIcon } from '@phosphor-icons/react/ArrowRight'

import { CodeBlock } from '~/components/markdown/CodeBlock'
import { charts } from '~/libraries'
import type { getChartsCatalogLanding } from '~/utils/charts-catalog.functions'

import activationChartSource from '../../../scripts/charts-landing/activation-chart.ts?raw'
import { LandingSection, LibraryLandingShell } from './LibraryLanding'
import {
  AccountChart,
  ActivationChart,
  BundleSizeChart,
  ThemeGallery,
} from './ChartsLandingGraphics'
import { CatalogChartsHero, ChartsCatalogGallery } from './ChartsCatalogGallery'

const chartPrompt = `Using TanStack Charts and the accounts array in this project, plot monthlyRevenue on x and retention on y. Size each point by seats with an explicit square-root radius scale, color it by segment, and preserve the original Account rows for typed tooltip and focus callbacks. Use the compact linear scale from @tanstack/charts/scales/linear so TanStack Charts can infer the domains, add the tooltip behavior from @tanstack/charts/tooltip, and render it through the React adapter with a useful ariaLabel.`

export default function ChartsLanding({
  catalog,
  catalogOrderSeed,
}: {
  catalog: Awaited<ReturnType<typeof getChartsCatalogLanding>>
  catalogOrderSeed: string
}) {
  return (
    <LibraryLandingShell
      description={charts.description}
      headline="A chart grammar you don't have to outgrow."
      hero={<CatalogChartsHero catalog={catalog} />}
      libraryId="charts"
      prompt={chartPrompt}
      promptLabel="Copy Charts prompt"
    >
      <style>{chartsLandingStyles}</style>

      <LandingSection
        id="common-charts"
        tone="raised"
        className="py-12 lg:py-14"
      >
        <div className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)] lg:items-end lg:gap-12">
          <h2 className="max-w-4xl font-ds-display text-ds-heading-1 md:text-ds-display-sm">
            Your next chart, already working.
          </h2>
          <div className="flex items-start lg:justify-end">
            <a
              href="/charts/catalog/"
              className="group inline-flex items-center gap-3 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)] transition-colors hover:text-text-primary"
            >
              Browse all {catalog.cases.length} examples
              <ArrowRightIcon
                aria-hidden="true"
                className="size-4 transition-transform group-hover:translate-x-1"
              />
            </a>
          </div>
        </div>
        <ChartsCatalogGallery catalog={catalog} orderSeed={catalogOrderSeed} />
      </LandingSection>

      <LandingSection id="bundle-size" tone="accent">
        <div className="grid gap-6 md:grid-cols-[0.82fr_1.18fr] md:items-end md:gap-12">
          <h2 className="max-w-4xl font-ds-display text-ds-heading-1 md:text-ds-display-md">
            A lot of chart. Not a lot of bundle.
          </h2>
          <p className="max-w-2xl border-l-2 border-[var(--landing-accent)] pl-5 text-ds-body-sm text-text-secondary sm:text-ds-body-md">
            Basic React line, 29 kB minified + gzip. SVG, compact scales, axes
            included.
          </p>
        </div>

        <div className="mt-10">
          <BundleSizeChart />
        </div>

        <a
          href="/charts/latest/docs/comparison"
          className="group mt-6 inline-flex items-center gap-3 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)] transition-colors hover:text-text-primary"
        >
          See the full bundle comparison
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 transition-transform group-hover:translate-x-1"
          />
        </a>
      </LandingSection>

      <LandingSection id="agent-authoring" tone="ink">
        <div className="grid min-w-0 gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-start lg:gap-14">
          <div className="min-w-0 lg:sticky lg:top-24">
            <h2 className="max-w-xl font-ds-display text-ds-heading-1 md:text-ds-display-md">
              Types stay connected to the source row.
            </h2>
            <p className="mt-6 max-w-xl text-ds-body-sm text-text-secondary sm:text-ds-body-md">
              Fields, datum types, inferred domains and keys, tooltips, and
              focus callbacks all trace back to the data you passed in. Every
              example compiles under strict TypeScript, and invalid definitions
              fail before they reach the browser.
            </p>

            <TypedDotExample />
          </div>

          <AccountChart />
        </div>
      </LandingSection>

      <LandingSection id="renderers" tone="raised">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-start lg:gap-14">
          <div>
            <h2 className="max-w-xl font-ds-display text-ds-heading-1 md:text-ds-display-md">
              SVG by default. Canvas where it earns its weight.
            </h2>
            <p className="mt-6 max-w-xl text-ds-body-sm text-text-secondary sm:text-ds-body-md">
              Move one paint-heavy mark to Canvas while axes, labels, focus,
              tooltips, responsive layout, hydration, and export keep working
              through one definition. Canvas and motion stay out of the default
              bundle until you import them.
            </p>
            <a
              href="/charts/latest/docs/reference/rendering-and-export"
              className="group mt-6 inline-flex items-center gap-3 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)] transition-colors hover:text-text-primary"
            >
              Rendering and export reference
              <ArrowRightIcon
                aria-hidden="true"
                className="size-4 transition-transform group-hover:translate-x-1"
              />
            </a>
          </div>

          <RendererSurfaceProof />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid gap-6 md:grid-cols-[0.82fr_1.18fr] md:items-end md:gap-12">
          <h2 className="max-w-3xl font-ds-display text-ds-heading-1 md:text-ds-display-sm">
            Make it look like your product.
          </h2>
          <p className="max-w-2xl border-l-2 border-[var(--landing-accent)] pl-5 text-ds-body-sm text-text-secondary sm:text-ds-body-md">
            Same data, scales, and interactions. CSS variables, themes, mark
            props, and custom tooltip content make the chart belong to your
            product.
          </p>
        </div>

        <div className="mt-8">
          <ThemeGallery />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid gap-6 md:grid-cols-[0.82fr_1.18fr] md:items-end md:gap-12">
          <h2 className="max-w-4xl font-ds-display text-ds-heading-1 md:text-ds-display-md">
            Add ranges, goals, and events without switching APIs.
          </h2>
          <p className="max-w-2xl text-ds-body-sm text-text-secondary sm:text-ds-body-md">
            The area, goal rule, activation line, release points, and labels
            each use the rows and channels they need, then share one coordinate
            system. The same definition mixes a compact linear scale with
            D3&apos;s UTC scale and monotone curve.
          </p>
        </div>

        <div className="mt-10 grid min-w-0 overflow-hidden rounded-xl border border-border-subtle bg-background-surface shadow-[0_24px_70px_-35px_rgb(var(--landing-glow)/0.5)] lg:grid-cols-[1.15fr_0.85fr]">
          <ActivationChart />

          <CodeBlock
            dataCodeTitle="activation-chart.ts"
            className="mt-0 self-stretch rounded-none border-0 border-t border-white/15 lg:border-l lg:border-t-0 [&>div:first-child]:rounded-none [&_pre]:max-h-[26rem] [&_pre]:overflow-auto [&_pre]:rounded-none [&_pre]:text-[11px] [&_pre]:leading-5 sm:[&_pre]:text-xs lg:[&_pre]:max-h-[clamp(24rem,32vw,31rem)]"
          >
            <code className="language-ts">{activationChartSource}</code>
          </CodeBlock>
        </div>

        <p className="mt-6 max-w-3xl text-ds-body-xs text-text-muted">
          TanStack Charts builds on Leland Wilkinson&apos;s grammar of graphics
          and the work of ggplot2, Vega-Lite, and Observable Plot. Its
          marks-and-channels API is most directly inspired by Observable Plot,
          but the runtime is an independent implementation.
        </p>

        <div className="mt-8 flex flex-wrap gap-x-7 gap-y-4">
          <a
            href="/charts/latest/docs/quick-start"
            className="group inline-flex items-center gap-3 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)] transition-colors hover:text-text-primary"
          >
            Build your first chart
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </a>
          <a
            href="/charts/catalog/"
            className="group inline-flex items-center gap-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-secondary transition-colors hover:text-text-primary"
          >
            Browse examples
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </a>
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function TypedDotExample() {
  return (
    <CodeBlock
      dataCodeTitle="account-health.tsx"
      className="mt-8 min-w-0 overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.3)] bg-[#0c1420] shadow-[0_18px_50px_-30px_rgb(var(--landing-glow)/0.45)] [&>div:first-child]:rounded-none [&_pre]:max-h-[30rem] [&_pre]:overflow-auto [&_pre]:rounded-none [&_pre]:text-[11px] [&_pre]:leading-5 sm:[&_pre]:text-xs"
    >
      <code className="language-ts">{accountChartSource}</code>
    </CodeBlock>
  )
}

function RendererSurfaceProof() {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border-subtle bg-background-surface shadow-[0_22px_60px_-38px_rgb(var(--landing-glow)/0.45)]">
      <div className="border-b border-border-subtle px-5 py-4">
        <p className="font-ds-display text-ds-heading-5 text-text-primary">
          One definition, three surface choices
        </p>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
        <CodeBlock
          dataCodeTitle="mixed-surface.ts"
          className="m-0 min-w-0 rounded-none border-0 border-b border-border-subtle lg:border-b-0 lg:border-r [&>div:first-child]:rounded-none [&_pre]:max-h-[24rem] [&_pre]:overflow-auto [&_pre]:rounded-none [&_pre]:text-[11px] [&_pre]:leading-5 sm:[&_pre]:text-xs"
        >
          <code className="language-ts">{mixedRendererSource}</code>
        </CodeBlock>

        <div className="divide-y divide-border-subtle">
          <RendererSurfaceRow
            change="Nothing"
            detail="Axes, labels, marks, and focus render as accessible SVG. Tooltips use an accessible HTML live region."
            title="Default SVG"
          />
          <RendererSurfaceRow
            change="One mark option"
            detail="Only the dense mark paints to Canvas. SVG guides and shared interaction stay in place."
            title="Mixed SVG + Canvas"
          />
          <RendererSurfaceRow
            change="One adapter import"
            detail="The whole chart paints to Canvas while the definition and host callbacks stay the same."
            title="Full Canvas"
          />
        </div>
      </div>

      <p className="border-t border-border-subtle px-5 py-4 text-ds-body-xs text-text-muted">
        The same definition also feeds the web adapters, vanilla DOM, static
        output, and the experimental React Native adapter.
      </p>
    </div>
  )
}

function RendererSurfaceRow({
  change,
  detail,
  title,
}: {
  change: string
  detail: string
  title: string
}) {
  return (
    <div className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-ds-display text-ds-heading-6 text-text-primary">
          {title}
        </p>
        <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
          {change}
        </span>
      </div>
      <p className="mt-2 text-ds-body-xs text-text-secondary">{detail}</p>
    </div>
  )
}

const mixedRendererSource = `import { canvasChartRenderer } from '@tanstack/charts/canvas'
import { defineChart, dot, lineY } from '@tanstack/charts'

const activity = defineChart({
  marks: [
    lineY(summary, {
      x: 'time',
      y: 'average',
    }),
    dot(events, {
      x: 'time',
      y: 'latency',
      renderer: canvasChartRenderer,
    }),
  ],
  scales,
  tooltip,
})`

const accountChartSource = `import { scaleLinear } from '@tanstack/charts/scales/linear'
import { defineChart, dot } from '@tanstack/charts'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/charts/react'
import { scaleSqrt } from 'd3-scale'

const accountHealth = defineChart({
  marks: [
    dot(accounts, {
      x: 'monthlyRevenue',
      y: 'retention',
      r: 'seats',
      rScale: {
        scale: () => scaleSqrt().range([4, 22]),
      },
      z: 'segment',
      key: 'id',
    }),
  ],
  scales: {
    x: {
      scale: scaleLinear,
      axis: { label: 'Monthly revenue ($k)' },
    },
    y: {
      scale: scaleLinear,
      axis: {
        label: '90-day retention',
        ticks: { format: (value) => percent.format(value) },
      },
    },
  },
  tooltip,
})

export function AccountHealthChart({
  onFocus,
}: {
  onFocus: (account: Account | null) => void
}) {
  return (
    <Chart
      definition={accountHealth}
      ariaLabel="Account health by revenue, retention, segment, and seats"
      onFocusChange={(point) => onFocus(point?.datum ?? null)}
    />
  )
}`

const chartsLandingStyles = `
  .charts-activation {
    --activation-bg: var(--color-background-surface);
    --activation-foreground: #15242b;
    --activation-muted: #66767c;
    --activation-border: rgb(21 36 43 / 0.13);
    --activation-grid: #4b7280;
    --activation-grid-opacity: 0.12;
    --activation-line: #087f8c;
    --activation-range: #48b9d4;
    --activation-range-opacity: 0.2;
    --activation-goal: #e4543d;
    --activation-release: #7c4dff;
  }

  .dark .charts-activation {
    --activation-bg: #071219;
    --activation-foreground: #edf8f8;
    --activation-muted: #91a9b2;
    --activation-border: rgb(237 248 248 / 0.13);
    --activation-grid: #8bb5c0;
    --activation-grid-opacity: 0.14;
    --activation-line: #5ee7ff;
    --activation-range: #3c98db;
    --activation-range-opacity: 0.28;
    --activation-goal: #ff806f;
    --activation-release: #ffd85e;
  }

  .charts-activation-graphic svg {
    overflow: hidden !important;
  }

  .charts-activation-graphic .ts-chart__grid {
    stroke-opacity: var(--activation-grid-opacity);
  }

  .charts-activation-graphic .ts-chart__area path {
    fill-opacity: var(--activation-range-opacity);
  }

  .charts-catalog-gallery-card {
    content-visibility: auto;
    contain-intrinsic-size: auto 288px auto 248px;
  }
`
