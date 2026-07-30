import { ArrowRight } from '@phosphor-icons/react'

import { CodeBlock } from '~/components/markdown/CodeBlock'

import activationChartSource from '../../../scripts/charts-landing/activation-chart.ts?raw'
import { LandingSection, LibraryLandingShell } from './LibraryLanding'
import {
  AccountChart,
  ActivationChart,
  BundleSizeFigure,
  KineticChartsHero,
  ResponsiveChartComparison,
  ThemeGallery,
} from './ChartsLandingGraphics'
import {
  ChartsCatalogGallery,
  type ChartsLandingCatalog,
} from './ChartsCatalogGallery'
import { LandingCopyPromptButton } from './LandingCopyPromptButton'

const chartPrompt = `Using TanStack Charts and the accounts array in this project, plot monthlyRevenue on x and retention on y. Size each point by seats, color it by segment, and keep the original Account type in tooltip and focus callbacks. Use D3 scale factories so TanStack Charts can infer the domains, enable the tooltip on the chart definition, add a useful ariaLabel, and render it through the React adapter.`

export default function ChartsLanding({
  catalog,
  version,
}: {
  catalog: ChartsLandingCatalog
  version: string
}) {
  return (
    <LibraryLandingShell
      description="Build from typed data, marks, channels, and D3 scales. Render responsive SVG through vanilla TypeScript or adapters for React, Vue, Svelte, Solid, Angular, Preact, Lit, Alpine, and Octane."
      headline="A chart grammar you don't have to outgrow."
      hero={<KineticChartsHero />}
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
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-ds-display text-ds-heading-1 md:text-ds-display-sm">
            Examples, not presets.
          </h2>
          <a
            href="/charts/catalog/"
            className="group inline-flex items-center gap-3 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)] transition-colors hover:text-text-primary"
          >
            Browse all examples
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </a>
        </div>
        <ChartsCatalogGallery
          catalog={catalog}
          variant="compact"
          version={version}
        />
      </LandingSection>

      <LandingSection id="agent-authoring" tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-start lg:gap-14">
          <div className="lg:sticky lg:top-24">
            <h2 className="max-w-xl font-ds-display text-ds-heading-1 md:text-ds-display-md">
              Agents write the chart. TypeScript checks the result.
            </h2>
            <p className="mt-6 max-w-xl text-ds-body-sm text-text-secondary sm:text-ds-body-md">
              Every example compiles under strict TypeScript. Fields, datum
              types, inferred domains and keys, tooltips, and focus callbacks
              stay connected to the source datum; the type suite rejects invalid
              definitions.
            </p>

            <div className="mt-8 rounded-xl border border-[color:rgb(var(--landing-glow)/0.3)] bg-background-surface p-5 shadow-[0_18px_50px_-30px_rgb(var(--landing-glow)/0.45)]">
              <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
                Example prompt
              </p>
              <p className="mt-3 text-ds-body-sm text-text-secondary">
                Plot monthly revenue against retention. Size each account by
                seats, color it by segment, add tooltips, and keep the Account
                type in every callback.
              </p>
              <div className="mt-4">
                <LandingCopyPromptButton
                  label="Copy full prompt"
                  prompt={chartPrompt}
                />
              </div>
            </div>

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
            Complete SVG charts. 24.2–24.8 KiB gzip.
          </h2>
          <p className="max-w-2xl text-ds-body-sm text-text-secondary sm:text-ds-body-md">
            Measured minified and gzipped from one-series charts in the{' '}
            <a
              href="/charts/latest/docs/comparison"
              className="text-[var(--landing-accent-bright)] underline decoration-current/30 underline-offset-4 hover:decoration-current"
            >
              reproducible comparison suite
            </a>
            . Granular imports leave unrelated marks and D3 modules out.
          </p>
        </div>

        <div className="mt-10 grid gap-5 xl:grid-cols-[0.62fr_1.38fr]">
          <BundleSizeFigure />
          <ResponsiveChartComparison />
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

        <div className="mt-10 grid min-w-0 overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.38)] bg-[#0b1728] shadow-[0_24px_70px_-35px_rgb(var(--landing-glow)/0.5)] lg:grid-cols-[1.15fr_0.85fr]">
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

      <LandingSection id="chart-atlas" tone="accent">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <h2 className="max-w-4xl font-ds-display text-ds-heading-1 md:text-ds-display-sm">
            Choose the chart by the question you&apos;re answering.
          </h2>
          <a
            href="/charts/catalog/"
            className="group inline-flex items-center gap-3 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)] transition-colors hover:text-text-primary"
          >
            All 100 examples
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </a>
        </div>

        <div className="mt-8 sm:mt-10">
          <ChartsCatalogGallery
            catalog={catalog}
            variant="expanded"
            version={version}
          />
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function TypedDotExample() {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.3)] bg-[#0c1420] text-ds-neutral-100 shadow-[0_18px_50px_-30px_rgb(var(--landing-glow)/0.45)]">
      <div className="flex justify-end border-b border-white/10 px-4 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-ds-neutral-200">
        <span className="text-ds-green-200">Account → SVG</span>
      </div>
      <pre className="overflow-x-auto p-4 font-ds-mono text-ds-mono-xs leading-6">
        <code>
          <span className="text-ds-blue-200">dot</span>
          <span className="text-ds-neutral-200">(</span>
          <span className="text-white">accounts</span>
          <span className="text-ds-neutral-200">{`, {\n`}</span>
          <span className="text-ds-neutral-300"> x: </span>
          <span className="text-ds-amber-200">&apos;monthlyRevenue&apos;</span>
          <span className="text-ds-neutral-200">{`,\n`}</span>
          <span className="text-ds-neutral-300"> y: </span>
          <span className="text-ds-amber-200">&apos;retention&apos;</span>
          <span className="text-ds-neutral-200">{`,\n`}</span>
          <span className="text-ds-neutral-300"> r: </span>
          <span className="text-ds-amber-200">&apos;seats&apos;</span>
          <span className="text-ds-neutral-200">{`,\n`}</span>
          <span className="text-ds-neutral-300"> z: </span>
          <span className="text-ds-amber-200">&apos;segment&apos;</span>
          <span className="text-ds-neutral-200">{`,\n})`}</span>
        </code>
      </pre>
    </div>
  )
}

const chartsLandingStyles = `
  .charts-activation-graphic svg {
    overflow: hidden !important;
  }

  .charts-kinetic-meta-enter {
    animation: charts-kinetic-meta-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes charts-kinetic-meta-enter {
    from {
      opacity: 0;
      transform: translateY(3px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .charts-kinetic-meta-enter {
      animation: none;
    }
  }
`
