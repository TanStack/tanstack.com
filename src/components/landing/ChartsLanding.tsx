import { CodeBlock } from '~/components/markdown/CodeBlock'

import activationChartSource from '../../../scripts/charts-landing/activation-chart.ts?raw'
import { LandingSection, LibraryLandingShell } from './LibraryLanding'
import {
  AccountChart,
  ActivationChart,
  BundleSizeFigure,
  ThemeGallery,
} from './ChartsLandingGraphics'
import {
  CatalogChartsHero,
  ChartsCatalogGallery,
  type ChartsLandingCatalog,
} from './ChartsCatalogGallery'

const chartPrompt = `Using TanStack Charts and the accounts array in this project, plot monthlyRevenue on x and retention on y. Size each point by seats, color it by segment, and keep the original Account type in tooltip and focus callbacks. Use D3 scale factories so TanStack Charts can infer the domains, enable the tooltip on the chart definition, add a useful ariaLabel, and render it through the React adapter.`

export default function ChartsLanding({
  catalog,
}: {
  catalog: ChartsLandingCatalog | null
}) {
  return (
    <LibraryLandingShell
      description="TanStack Charts 0.3.1 is on npm. A compact React line consumer is 16.48 KiB gzip; its framework-neutral scene is 8.12 KiB."
      headline="A chart grammar you don't have to outgrow."
      hero={catalog ? <CatalogChartsHero catalog={catalog} /> : null}
      libraryId="charts"
      prompt={chartPrompt}
      promptLabel="Copy Charts prompt"
    >
      <style>{chartsLandingStyles}</style>

      {catalog ? (
        <LandingSection
          id="common-charts"
          tone="raised"
          className="py-12 lg:py-14"
        >
          <div className="mb-7">
            <h2 className="font-ds-display text-ds-heading-1 md:text-ds-display-sm">
              All mark, no chart.
            </h2>
            <p className="mt-2 text-ds-body-md text-text-secondary">
              Just a few examples. The possibilities are endless.
            </p>
          </div>
          <ChartsCatalogGallery catalog={catalog} />
        </LandingSection>
      ) : null}

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

      <LandingSection tone="raised">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-end lg:gap-16">
          <h2 className="max-w-3xl font-ds-display text-ds-heading-1 md:text-ds-display-md">
            16.48 KiB for a compact React line.
          </h2>
          <p className="max-w-2xl text-ds-body-sm text-text-secondary sm:text-ds-body-md">
            The framework-neutral scene is 8.12 KiB and retains neither D3 nor
            InternMap. For an apples-to-apples comparison, the{' '}
            <a
              href="/charts/latest/docs/comparison"
              className="text-[var(--landing-accent-bright)] underline decoration-current/30 underline-offset-4 hover:decoration-current"
            >
              pinned 12-case suite
            </a>{' '}
            measures full cold-page browser bundles; Bklit&apos;s interactive
            line is included alongside the published library ranges.
          </p>
        </div>

        <div className="mt-10">
          <BundleSizeFigure />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid gap-6 md:grid-cols-[0.82fr_1.18fr] md:items-end md:gap-12">
          <h2 className="max-w-4xl font-ds-display text-ds-heading-1 md:text-ds-display-md">
            Layer marks over shared scales.
          </h2>
          <p className="max-w-2xl text-ds-body-sm text-text-secondary sm:text-ds-body-md">
            Area, rules, lines, points, and labels share one coordinate system.
            The definition beside the chart is the whole composition.
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
      dataCodeTitle="account-health.ts"
      className="mt-8 overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.3)] bg-[#0c1420] shadow-[0_18px_50px_-30px_rgb(var(--landing-glow)/0.45)] [&>div:first-child]:rounded-none [&_pre]:max-h-[30rem] [&_pre]:overflow-auto [&_pre]:rounded-none [&_pre]:text-[11px] [&_pre]:leading-5 sm:[&_pre]:text-xs"
    >
      <code className="language-ts">{accountChartSource}</code>
    </CodeBlock>
  )
}

const accountChartSource = `const accountHealth = defineChart({
  marks: [
    dot(accounts, {
      x: 'monthlyRevenue',
      y: 'retention',
      r: 'seats',
      z: 'segment',
      key: 'id',
    }),
  ],
  x: {
    scale: scaleLinear(),
    label: 'Monthly revenue ($k)',
  },
  y: {
    scale: scaleLinear(),
    label: '90-day retention',
    format: (value) => percent.format(value),
  },
  tooltip: true,
})`

const chartsLandingStyles = `
  .charts-activation {
    --activation-bg: #f8f5ed;
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

  .charts-catalog-card-light {
    background: #fff;
  }

  .charts-catalog-card-dark {
    background: #071219;
  }

  .charts-catalog-card-light .charts-catalog-chart {
    --ts-chart-1: #2497bd;
    --ts-chart-2: #e46244;
    --ts-chart-3: #39a84b;
    --ts-chart-4: #805ad5;
    --ts-chart-5: #e69a16;
    --ts-chart-6: #667c87;
  }

  .charts-catalog-card-dark .charts-catalog-chart {
    --ts-chart-1: #61e8ff;
    --ts-chart-2: #ff806f;
    --ts-chart-3: #b9f227;
    --ts-chart-4: #c4a7ff;
    --ts-chart-5: #ffd85e;
    --ts-chart-6: #91a9b4;
  }

  .charts-catalog-card-light .charts-catalog-chart > div,
  .charts-catalog-card-light .charts-catalog-chart svg.ts-chart {
    background: #fff;
  }

  .charts-catalog-card-dark .charts-catalog-chart > div,
  .charts-catalog-card-dark .charts-catalog-chart svg.ts-chart {
    background: #071219;
  }

  .charts-catalog-hero-frame .ts-chart__legend,
  .charts-catalog-gallery-card .ts-chart__legend {
    display: none;
  }

  .charts-catalog-hero-frame .ts-chart text,
  .charts-catalog-gallery-card .ts-chart text {
    font-size: 9px;
  }

  .charts-catalog-card-light .ts-chart__grid {
    stroke: #071219;
    stroke-opacity: 0.1;
  }

  .charts-catalog-card-dark .ts-chart__grid {
    stroke: #d9edf1;
    stroke-opacity: 0.13;
  }

  .charts-catalog-card-light .ts-chart__axes line,
  .charts-catalog-card-light .ts-chart__axes path {
    stroke: #071219;
    stroke-opacity: 0.32;
  }

  .charts-catalog-card-dark .ts-chart__axes line,
  .charts-catalog-card-dark .ts-chart__axes path {
    stroke: #d9edf1;
    stroke-opacity: 0.28;
  }

  .charts-catalog-card-light .ts-chart__axes text {
    fill: #071219;
    fill-opacity: 0.6;
  }

  .charts-catalog-card-dark .ts-chart__axes text {
    fill: #d9edf1;
    fill-opacity: 0.62;
  }

  .charts-catalog-hero-frame {
    animation: charts-catalog-hero-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .charts-catalog-title-enter {
    animation: charts-catalog-title-enter 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes charts-catalog-hero-enter {
    from {
      opacity: 0.25;
      filter: blur(4px);
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      filter: blur(0);
      transform: translateY(0);
    }
  }

  @keyframes charts-catalog-title-enter {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .charts-catalog-hero-frame,
    .charts-catalog-title-enter {
      animation: none;
    }
  }
`
