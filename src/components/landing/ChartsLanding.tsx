import { CodeBlock } from '~/components/markdown/CodeBlock'
import { charts } from '~/libraries'
import type { getChartsCatalogLanding } from '~/utils/charts-catalog.functions'

import activationChartSource from '../../../scripts/charts-landing/activation-chart.ts?raw'
import { LandingSection, LibraryLandingShell } from './LibraryLanding'
import {
  AccountChart,
  ActivationChart,
  ThemeGallery,
} from './ChartsLandingGraphics'
import { CatalogChartsHero, ChartsCatalogGallery } from './ChartsCatalogGallery'

const chartPrompt = `Using TanStack Charts and the accounts array in this project, plot monthlyRevenue on x and retention on y. Size each point by seats with an explicit square-root radius scale, color it by segment, and preserve the original Account rows for typed tooltip and focus callbacks. Use the compact linear scale from @tanstack/charts-scales/linear so TanStack Charts can infer the domains, add the tooltip behavior from @tanstack/charts/tooltip, and render it through the React adapter with a useful ariaLabel.`

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
        <div className="mb-7">
          <h2 className="font-ds-display text-ds-heading-1 md:text-ds-display-sm">
            All mark, no chart.
          </h2>
        </div>
        <ChartsCatalogGallery catalog={catalog} orderSeed={catalogOrderSeed} />
      </LandingSection>

      <LandingSection id="agent-authoring" tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-start lg:gap-14">
          <div className="lg:sticky lg:top-24">
            <h2 className="max-w-xl font-ds-display text-ds-heading-1 md:text-ds-display-md">
              Type Safe &amp; Declarative for both Humans &amp; Agents
            </h2>
            <p className="mt-6 max-w-xl text-ds-body-sm text-text-secondary sm:text-ds-body-md">
              Every example compiles under strict TypeScript. Fields, datum
              types, inferred domains and keys, tooltips, and focus callbacks
              stay connected to the source datum; the type suite rejects invalid
              definitions.
            </p>

            <TypedDotExample />
          </div>

          <AccountChart />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid gap-6 md:grid-cols-[0.82fr_1.18fr] md:items-end md:gap-12">
          <h2 className="max-w-3xl font-ds-display text-ds-heading-1 md:text-ds-display-sm">
            Make it look like your product.
          </h2>
          <p className="max-w-2xl border-l-2 border-[var(--landing-accent)] pl-5 text-ds-body-sm text-text-secondary sm:text-ds-body-md">
            Same data and scales. CSS variables, themes, mark props, custom
            tooltips, or your own renderer control the rest.
          </p>
        </div>

        <div className="mt-8">
          <ThemeGallery />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid gap-6 md:grid-cols-[0.82fr_1.18fr] md:items-end md:gap-12">
          <h2 className="max-w-4xl font-ds-display text-ds-heading-1 md:text-ds-display-md">
            Compose from marks to complete views.
          </h2>
          <p className="max-w-2xl text-ds-body-sm text-text-secondary sm:text-ds-body-md">
            Layer marks when they share a coordinate system. For compound
            charts, <code>composeViews</code> places complete definitions with
            fill, grid, layer, and inset utilities. Each view keeps its own
            scales unless you share or align them.{' '}
            <a
              href="/charts/latest/docs/reference/view-composition"
              className="text-[var(--landing-accent-bright)] underline decoration-current/30 underline-offset-4 hover:decoration-current"
            >
              View composition reference.
            </a>
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
      </LandingSection>
    </LibraryLandingShell>
  )
}

function TypedDotExample() {
  return (
    <CodeBlock
      dataCodeTitle="account-health.tsx"
      className="mt-8 overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.3)] bg-[#0c1420] shadow-[0_18px_50px_-30px_rgb(var(--landing-glow)/0.45)] [&>div:first-child]:rounded-none [&_pre]:max-h-[30rem] [&_pre]:overflow-auto [&_pre]:rounded-none [&_pre]:text-[11px] [&_pre]:leading-5 sm:[&_pre]:text-xs"
    >
      <code className="language-ts">{accountChartSource}</code>
    </CodeBlock>
  )
}

const accountChartSource = `import { scaleLinear } from '@tanstack/charts-scales/linear'
import { defineChart, dot } from '@tanstack/charts'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/react-charts'
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
