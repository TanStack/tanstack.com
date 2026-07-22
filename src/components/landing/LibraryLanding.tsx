import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowRight,
  ArrowsClockwise,
  CalendarDots,
  DownloadSimple,
  Plus,
  Star,
  Swap,
  type Icon,
} from '@phosphor-icons/react'

import { LibraryWordmark } from '~/components/LibraryWordmark'
import { getLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { ossStatsQuery, recentDownloadsQuery } from '~/queries/stats'
import { LandingCopyPromptButton } from './LandingCopyPromptButton'

export type LibraryLandingId = Exclude<
  LibraryId,
  'create-tsrouter-app' | 'mcp' | 'react-charts'
>

export type LibraryLandingWorkbenchItem = {
  activity: number
  badge: string
  key: string
  title: string
}

export type LibraryLandingFeature = {
  body: string
  icon: Icon
  label: string
  title: string
}

export type LibraryLandingStep = {
  body: string
  label: string
}

export type LibraryLandingFlowStep = {
  code: string
  label: string
}

export type LibraryLandingConfig = {
  description: string
  distinction: string
  features: readonly LibraryLandingFeature[]
  flow: {
    body: string
    label: string
    steps: readonly LibraryLandingFlowStep[]
    title: string
  }
  headline: string
  hero: {
    actionLabel: string
    detailBody: string
    detailTitle: string
    facts: readonly { label: string; value: string }[]
    items: readonly LibraryLandingWorkbenchItem[]
    label: string
  }
  libraryId: LibraryLandingId
  lifecycle: {
    body: string
    label: string
    steps: readonly LibraryLandingStep[]
    title: string
  }
  prompt: string
  promptLabel?: string
}

type LibraryLandingTheme = {
  accent: string
  accentBright: string
  accentInk: string
  accentMuted: string
  glow: string
}

const libraryLandingThemes = {
  ai: theme(
    'var(--color-lib-ai)',
    '#f05b9f',
    '#17030c',
    '#f4b6d4',
    '221 0 112',
  ),
  cli: theme(
    'var(--color-lib-cli)',
    '#8f6ae8',
    '#f8f5ff',
    '#c9b7f4',
    '73 10 189',
  ),
  config: theme(
    'var(--color-ds-neutral-200)',
    'var(--color-ds-neutral-100)',
    '#111111',
    'var(--color-ds-neutral-100)',
    '171 165 148',
  ),
  db: theme('var(--color-lib-db)', '#ff8a4a', '#1a0800', '#ffc6a6', '233 81 0'),
  devtools: theme(
    'var(--color-ds-neutral-200)',
    'var(--color-ds-neutral-100)',
    '#111111',
    'var(--color-ds-neutral-100)',
    '171 165 148',
  ),
  form: theme(
    'var(--color-lib-form)',
    'var(--color-ds-amber-300)',
    '#171003',
    'var(--color-ds-amber-100)',
    '228 174 34',
  ),
  hotkeys: theme(
    'var(--color-lib-hotkeys)',
    '#ff7375',
    '#1c0405',
    '#ffc0c1',
    '246 47 50',
  ),
  intent: theme(
    'var(--color-lib-intent)',
    'var(--color-ds-blue-200)',
    '#031317',
    'var(--color-ds-blue-100)',
    '92 175 223',
  ),
  pacer: theme(
    'var(--color-lib-pacer)',
    '#c7f28a',
    '#0d1503',
    '#dcf7b5',
    '169 228 81',
  ),
  query: theme(
    'var(--color-ds-terracotta-400)',
    'var(--color-ds-terracotta-300)',
    '#1c0a04',
    'var(--color-ds-terracotta-100)',
    '195 80 43',
  ),
  ranger: theme(
    'var(--color-ds-blue-300)',
    'var(--color-ds-blue-200)',
    '#061116',
    'var(--color-ds-blue-100)',
    '105 168 183',
  ),
  router: theme(
    'var(--color-lib-router)',
    'var(--color-ds-green-300)',
    '#04130a',
    'var(--color-ds-green-100)',
    '59 203 119',
  ),
  start: theme(
    'var(--color-lib-start)',
    '#65dce5',
    '#031517',
    '#b7f0f3',
    '0 185 200',
  ),
  store: theme(
    'var(--color-lib-store)',
    'var(--color-twine-300)',
    '#160d06',
    'var(--color-twine-200)',
    '135 60 0',
  ),
  table: theme(
    'var(--color-lib-table)',
    'var(--color-ds-blue-300)',
    '#03121e',
    'var(--color-ds-blue-100)',
    '0 141 237',
  ),
  virtual: theme(
    'var(--color-lib-virtual)',
    'var(--color-ds-purple-200)',
    '#140718',
    'var(--color-ds-purple-100)',
    '188 144 229',
  ),
  workflow: theme(
    'var(--color-ds-blue-400)',
    'var(--color-ds-blue-300)',
    '#031219',
    'var(--color-ds-blue-100)',
    '70 157 184',
  ),
} satisfies Record<LibraryLandingId, LibraryLandingTheme>

function theme(
  accent: string,
  accentBright: string,
  accentInk: string,
  accentMuted: string,
  glow: string,
): LibraryLandingTheme {
  return { accent, accentBright, accentInk, accentMuted, glow }
}

type LibraryLandingStyle = React.CSSProperties & {
  '--landing-accent': string
  '--landing-accent-bright': string
  '--landing-accent-ink': string
  '--landing-accent-muted': string
  '--landing-glow': string
}

export function LibraryLanding({ config }: { config: LibraryLandingConfig }) {
  const library = getLibrary(config.libraryId)
  const { version } = useParams({ strict: false })
  const resolvedVersion = version ?? library.latestVersion
  const colors = libraryLandingThemes[config.libraryId]
  const landingStyle: LibraryLandingStyle = {
    '--landing-accent': colors.accent,
    '--landing-accent-bright': colors.accentBright,
    '--landing-accent-ink': colors.accentInk,
    '--landing-accent-muted': colors.accentMuted,
    '--landing-glow': colors.glow,
  }

  return (
    <main
      className="w-full min-w-0 overflow-x-hidden bg-[#0a0a0a] font-sans text-white [color-scheme:dark]"
      style={landingStyle}
    >
      <section className="relative overflow-hidden border-b border-[#1e1e1e]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(90% 95% at 54% 108%, rgb(var(--landing-glow) / 0.5), transparent 62%), linear-gradient(180deg, rgb(var(--landing-glow) / 0.08), transparent 58%)',
          }}
        />

        <div className="relative mx-auto w-full max-w-[96rem] px-5 py-14 md:px-10 lg:px-12 lg:py-16 2xl:px-20">
          <div className="grid items-start gap-12 xl:min-h-[29rem] xl:grid-cols-[minmax(25rem,0.82fr)_minmax(34rem,1.18fr)] xl:gap-10">
            <div className="max-w-[35rem]">
              <div className="flex flex-wrap items-start gap-3">
                <div>
                  <img
                    src="/images/brand/tanstack-landscape-white.svg"
                    alt="TanStack"
                    className="h-[18px] w-auto"
                  />
                  <h1 className="mt-1">
                    <LibraryWordmark
                      className="block font-ds-display"
                      colorProduct={false}
                      includeTanStack={false}
                      library={library}
                      productClassName="bg-[linear-gradient(110deg,var(--landing-accent-bright),var(--landing-accent))] bg-clip-text pr-1 text-[4rem] font-bold leading-[0.9] tracking-[-0.04em] text-transparent [filter:drop-shadow(0_4px_4px_rgb(0_0_0/0.25))] sm:text-[4.5rem] lg:text-ds-display-2xl"
                    />
                  </h1>
                </div>
                {library.badge ? (
                  <span className="mt-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 font-ds-mono text-[10px] font-medium uppercase tracking-[0.16em] text-white/60">
                    {library.badge}
                  </span>
                ) : null}
              </div>

              <p className="mt-10 max-w-[30rem] text-ds-heading-4 text-white">
                {config.headline}
              </p>
              <p className="mt-5 max-w-[34rem] text-ds-body-sm text-[#aea691] sm:text-ds-body-md">
                {config.description}
              </p>

              <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
                <Link
                  to="/$libraryId/$version/docs"
                  params={{
                    libraryId: config.libraryId,
                    version: resolvedVersion,
                  }}
                  className="inline-flex items-center gap-3 rounded-xl px-5 py-3 text-ds-label-lg text-[var(--landing-accent-ink)] shadow-[inset_-5px_-5px_7px_-5px_var(--landing-accent-muted),0_12px_35px_rgb(var(--landing-glow)/0.2)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] motion-reduce:transition-none"
                  style={{
                    backgroundImage:
                      'linear-gradient(105deg, var(--landing-accent), var(--landing-accent-bright))',
                  }}
                >
                  Docs
                  <ArrowRight aria-hidden="true" size={20} weight="bold" />
                </Link>
                <LandingCopyPromptButton
                  className="border-0 bg-transparent px-0 py-2 font-ds-mono text-ds-mono-caps uppercase text-white/75 hover:bg-transparent hover:text-white dark:border-0 dark:bg-transparent dark:text-white/75 dark:hover:border-0 sm:w-auto"
                  label={config.promptLabel ?? 'Copy prompt'}
                  prompt={config.prompt}
                />
              </div>
            </div>

            <LandingWorkbench config={config.hero} />
          </div>

          <LandingStats libraryId={config.libraryId} />
        </div>
      </section>

      <FeatureSection
        distinction={config.distinction}
        features={config.features}
        libraryId={config.libraryId}
      />
      <LifecycleSection lifecycle={config.lifecycle} />
      <FlowSection flow={config.flow} />

      <div aria-hidden="true" className="h-24 bg-[#0a0a0a]" />
    </main>
  )
}

function LandingWorkbench({
  config,
}: {
  config: LibraryLandingConfig['hero']
}) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [isLive, setIsLive] = React.useState(true)
  const activeItem = config.items[activeIndex]

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.45)] bg-[#090909] shadow-[inset_-3px_-4px_18px_-7px_var(--landing-accent),0_24px_70px_rgb(0_0_0/0.28)]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="font-ds-mono text-[10px] font-medium uppercase tracking-[0.16em] text-white/65">
          {config.label}
        </span>
      </div>

      <div className="grid min-h-[22rem] lg:grid-cols-[1.08fr_0.82fr]">
        <div className="space-y-3 border-white/5 p-4 lg:border-r">
          <div className="mb-4 flex flex-wrap items-center gap-2 font-ds-mono text-[9px] font-medium uppercase tracking-[0.12em]">
            <span className="rounded-sm bg-emerald-500 px-2 py-1 text-emerald-950">
              {isLive ? 'fresh' : 'paused'}
            </span>
            <span className="rounded-sm bg-white/5 px-2 py-1 text-white/30">
              ready / local
            </span>
          </div>

          {config.items.map((item, index) => {
            const isActive = index === activeIndex

            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={isActive}
                className="block w-full rounded-lg border border-transparent bg-[#171717] p-4 text-left transition-colors hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[color:rgb(var(--landing-glow)/0.42)] aria-pressed:bg-[#1b1715]"
                onClick={() => setActiveIndex(index)}
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block truncate font-ds-mono text-[13px] font-medium text-white">
                      {item.key}
                    </span>
                    <span className="mt-1 block text-ds-body-xs text-white/35">
                      {item.title}
                    </span>
                  </span>
                  <span className="shrink-0 rounded bg-[var(--landing-accent)] px-2 py-1 font-ds-mono text-[10px] font-medium text-[var(--landing-accent-ink)]">
                    {item.badge}
                  </span>
                </span>
                <span className="mt-4 flex items-center gap-3">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                    <span
                      className="block h-full rounded-full bg-[var(--landing-accent)] transition-[width] duration-500 motion-reduce:transition-none"
                      style={{ width: `${item.activity}%` }}
                    />
                  </span>
                  <span className="font-ds-mono text-[9px] font-medium uppercase tracking-[0.16em] text-white/30">
                    {item.activity}%
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              aria-pressed={isLive}
              className="rounded-md bg-[#ff5f5f] px-3 py-2 text-ds-label-sm text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => setIsLive((current) => !current)}
            >
              Live {isLive ? 'on' : 'off'}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#ff5f5f] px-3 py-2 text-ds-label-sm text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() =>
                setActiveIndex((current) =>
                  config.items.length ? (current + 1) % config.items.length : 0,
                )
              }
            >
              <Plus aria-hidden="true" size={13} weight="bold" />
              {config.actionLabel}
            </button>
          </div>

          <div className="mt-7" aria-live="polite">
            <p className="text-ds-heading-4">{config.detailTitle}</p>
            {activeItem ? (
              <p className="mt-2 truncate font-ds-mono text-ds-mono-xs text-[var(--landing-accent-bright)]">
                {activeItem.key}
              </p>
            ) : null}
            <p className="mt-4 text-ds-body-sm text-white/45">
              {config.detailBody}
            </p>
          </div>

          <dl className="mt-auto space-y-2 rounded-lg bg-[#121212] p-4 text-ds-body-xs">
            {config.facts.map((fact) => (
              <div key={fact.label} className="flex justify-between gap-3">
                <dt className="text-white/35">{fact.label}</dt>
                <dd className="text-right font-ds-mono font-medium text-white/85">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}

function LandingStats({ libraryId }: { libraryId: LibraryLandingId }) {
  const library = getLibrary(libraryId)
  const { data: stats } = useQuery(ossStatsQuery({ library }))
  const { data: downloads } = useQuery(recentDownloadsQuery({ library }))
  const metrics = [
    {
      href: 'https://www.npmjs.com/org/tanstack',
      icon: DownloadSimple,
      label: 'total downloads',
      value: formatCompactNumber(stats?.npm?.totalDownloads),
    },
    {
      href: 'https://www.npmjs.com/org/tanstack',
      icon: CalendarDots,
      label: 'weekly downloads',
      value: formatFullNumber(downloads?.weeklyDownloads),
    },
    {
      href: `https://github.com/${library.repo}`,
      icon: Star,
      label: 'GitHub stars',
      value: formatFullNumber(stats?.github?.starCount),
    },
  ]

  return (
    <div className="mx-auto mt-12 grid w-full max-w-[44rem] overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.22)] bg-black/70 shadow-[inset_-3px_-4px_18px_-7px_var(--landing-accent)] sm:grid-cols-3">
      {metrics.map((metric) => {
        const Icon = metric.icon

        return (
          <a
            key={metric.label}
            href={metric.href}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-b-0 hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--landing-accent-bright)] sm:border-r sm:border-b-0 sm:last:border-r-0"
          >
            <Icon
              aria-hidden="true"
              className="shrink-0 text-[var(--landing-accent)]"
              size={24}
              weight="light"
            />
            <span className="min-w-0">
              <span className="block text-ds-heading-4 text-white/65 tabular-nums transition-colors group-hover:text-white">
                {metric.value}
              </span>
              <span className="mt-1 block font-ds-mono text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--landing-accent)]">
                {metric.label}
              </span>
            </span>
          </a>
        )
      })}
    </div>
  )
}

function FeatureSection({
  distinction,
  features,
  libraryId,
}: {
  distinction: string
  features: readonly LibraryLandingFeature[]
  libraryId: LibraryLandingId
}) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const activeFeature = features[activeIndex] ?? features[0]
  const tabPanelId = `${libraryId}-feature-panel`

  if (!activeFeature) {
    return null
  }

  const selectTab = (index: number) => {
    setActiveIndex(index)
    tabRefs.current[index]?.focus()
  }

  return (
    <section className="border-b border-[#1e1e1e] bg-[#0a0a0a] px-5 py-16 md:px-10 lg:px-12 lg:py-20 2xl:px-20">
      <div className="mx-auto w-full max-w-[96rem]">
        <LandingEyebrow icon={<ArrowsClockwise aria-hidden="true" size={14} />}>
          {distinction}
        </LandingEyebrow>

        <div className="mt-12 grid items-stretch gap-10 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-14">
          <div
            role="tablist"
            aria-label="Product capabilities"
            className="flex gap-5 overflow-x-auto pb-2 lg:flex-col lg:items-start lg:overflow-visible lg:pb-0"
          >
            {features.map((feature, index) => {
              const FeatureIcon = feature.icon

              return (
                <button
                  key={feature.label}
                  ref={(button) => {
                    tabRefs.current[index] = button
                  }}
                  id={`${libraryId}-feature-${index}`}
                  type="button"
                  role="tab"
                  aria-controls={tabPanelId}
                  aria-selected={index === activeIndex}
                  tabIndex={index === activeIndex ? 0 : -1}
                  className="inline-flex shrink-0 items-center gap-3 border-b border-[#3a3a3a] pb-4 text-left font-ds-display text-[18px] leading-[1.2] font-light text-[#a3a3a3] transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-selected:border-[var(--landing-accent-bright)] aria-selected:text-[var(--landing-accent-bright)] lg:text-[24px]"
                  onClick={() => setActiveIndex(index)}
                  onKeyDown={(event) => {
                    let nextIndex: number | undefined

                    if (
                      event.key === 'ArrowDown' ||
                      event.key === 'ArrowRight'
                    ) {
                      nextIndex = (index + 1) % features.length
                    } else if (
                      event.key === 'ArrowUp' ||
                      event.key === 'ArrowLeft'
                    ) {
                      nextIndex =
                        (index - 1 + features.length) % features.length
                    } else if (event.key === 'Home') {
                      nextIndex = 0
                    } else if (event.key === 'End') {
                      nextIndex = features.length - 1
                    }

                    if (nextIndex !== undefined) {
                      event.preventDefault()
                      selectTab(nextIndex)
                    }
                  }}
                >
                  <FeatureIcon aria-hidden="true" className="size-6 shrink-0" />
                  <span>{feature.label}</span>
                </button>
              )
            })}
          </div>

          <div
            id={tabPanelId}
            role="tabpanel"
            aria-labelledby={`${libraryId}-feature-${activeIndex}`}
            className="flex min-h-[18rem] flex-col justify-between rounded-xl border border-[color:rgb(var(--landing-glow)/0.34)] bg-[color:rgb(var(--landing-glow)/0.14)] px-7 py-8 md:px-12 md:py-10 lg:px-16"
          >
            <h2 className="max-w-[41rem] text-ds-heading-1 md:text-ds-display-sm">
              {activeFeature.title}
            </h2>
            <p className="mt-12 max-w-[34rem] text-ds-body-md text-[var(--landing-accent-muted)] md:text-ds-body-lg">
              {activeFeature.body}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function LifecycleSection({
  lifecycle,
}: {
  lifecycle: LibraryLandingConfig['lifecycle']
}) {
  return (
    <section className="border-b border-[#242424] bg-[#171717] px-5 py-16 md:px-10 lg:px-12 lg:py-20 2xl:px-20">
      <div className="mx-auto grid w-full max-w-[90rem] items-center gap-14 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(32rem,1.1fr)] lg:gap-16">
        <div className="max-w-[36rem]">
          <LandingEyebrow
            icon={<ArrowsClockwise aria-hidden="true" size={14} />}
          >
            {lifecycle.label}
          </LandingEyebrow>
          <h2 className="mt-8 text-ds-display-sm md:text-ds-display-md">
            {lifecycle.title}
          </h2>
          <p className="mt-7 max-w-[34rem] text-ds-body-sm text-white/45">
            {lifecycle.body}
          </p>
        </div>

        <div className="grid sm:grid-cols-2">
          {lifecycle.steps.map((step, index) => (
            <div
              key={step.label}
              className="min-h-[11.75rem] border-b border-white/10 p-6 sm:[&:nth-child(odd)]:border-r"
            >
              <p
                className={
                  index === 0
                    ? 'font-ds-display text-ds-display-md font-light text-[var(--landing-accent-muted)]'
                    : 'font-ds-display text-ds-display-md font-light text-[var(--landing-accent)]'
                }
              >
                {index + 1}
              </p>
              <h3 className="mt-3 text-ds-heading-5">{step.label}</h3>
              <p className="mt-3 text-ds-body-xs text-white/35">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FlowSection({ flow }: { flow: LibraryLandingConfig['flow'] }) {
  const primarySteps = flow.steps.slice(0, 3)
  const branchStep = flow.steps[3]

  return (
    <section className="min-h-[37.5rem] border-b border-[#151515] bg-[#0b0b0c] px-5 py-16 md:px-10 lg:px-12 lg:py-20 2xl:px-20">
      <div className="mx-auto flex w-full max-w-[70rem] flex-col items-center text-center">
        <LandingEyebrow icon={<Swap aria-hidden="true" size={16} />}>
          {flow.label}
        </LandingEyebrow>
        <h2 className="mt-6 max-w-[47rem] text-ds-heading-1 md:text-ds-display-sm">
          {flow.title}
        </h2>
        <p className="mt-6 max-w-[47rem] text-ds-body-sm text-white/35">
          {flow.body}
        </p>

        <div className="mt-14 w-full max-w-[58rem]">
          <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:gap-0">
            {primarySteps.map((step, index) => (
              <React.Fragment key={step.label}>
                <FlowStep step={step} />
                {index < primarySteps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="mx-auto h-7 w-px bg-[color:rgb(var(--landing-glow)/0.7)] lg:h-px lg:w-10"
                  />
                ) : null}
              </React.Fragment>
            ))}
          </div>

          {branchStep ? (
            <div className="mt-3 flex justify-end pr-[8%] lg:pr-[15%]">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className="h-8 border-l border-dashed border-[var(--landing-accent)]"
                />
                <FlowStep accent step={branchStep} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function FlowStep({
  accent = false,
  step,
}: {
  accent?: boolean
  step: LibraryLandingFlowStep
}) {
  return (
    <div
      className={
        accent
          ? 'min-w-0 rounded-3xl border border-[var(--landing-accent)] bg-[var(--landing-accent-bright)] px-5 py-4 text-left text-[var(--landing-accent-ink)] lg:min-w-[12rem]'
          : 'min-w-0 flex-1 rounded-3xl border border-[var(--landing-accent)] bg-[#171717] px-5 py-4 text-left lg:min-w-[12rem]'
      }
    >
      <p
        className={
          accent
            ? 'font-ds-mono text-ds-mono-caps uppercase text-[var(--landing-accent-ink)]'
            : 'font-ds-mono text-ds-mono-caps uppercase text-[var(--landing-accent-bright)]'
        }
      >
        {step.label}
      </p>
      <p className="mt-4 break-words font-ds-mono text-ds-mono-xs font-medium">
        {step.code}
      </p>
    </div>
  )
}

function LandingEyebrow({
  children,
  icon,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <p className="inline-flex items-center gap-2 font-ds-mono text-ds-mono-caps uppercase text-[var(--landing-accent-bright)]">
      {icon}
      {children}
    </p>
  )
}

function formatCompactNumber(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return '—'
  }

  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value)
}

function formatFullNumber(value: number | null | undefined) {
  return value && Number.isFinite(value) ? value.toLocaleString() : '—'
}
