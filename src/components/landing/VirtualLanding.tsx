import * as React from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  BoxSelect,
  Eye,
  Gauge,
  Grid3X3,
  List,
  MoveHorizontal,
  MousePointer2,
  Ruler,
  Scaling,
  Sparkles,
  StretchHorizontal,
  Timer,
} from 'lucide-react'

import { BottomCTA } from '~/components/BottomCTA'
import { Footer } from '~/components/Footer'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { LazyLandingCommunitySection } from '~/components/LazyLandingCommunitySection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { LibraryDownloadsMicro } from '~/components/LibraryDownloadsMicro'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import { LibraryWordmark } from '~/components/LibraryWordmark'
import LandingPageGad from '~/components/LandingPageGad'
import { getLibrary } from '~/libraries'
import { virtualProject } from '~/libraries/virtual'
import type { LandingComponentProps } from '~/routes/$libraryId/$version'

import { LandingEcosystemProof } from '~/components/landing/LandingEcosystemProof'
import { LandingCopyPromptButton } from '~/components/landing/LandingCopyPromptButton'
const library = getLibrary('virtual')
const virtualAgentPrompt = [
  'Build a TanStack Virtual experience for a TypeScript app.',
  'Use a headless virtualizer for a large list or grid, render only visible items plus overscan, support dynamic measurement where rows can change size, and keep the scroll container/markup owned by the product UI.',
  'Include smooth scrolling, sticky affordances where useful, and clear empty/loading states without replacing the app design system.',
].join(' ')

const heroProof = [
  {
    label: 'Visible window',
    value: 'render the viewport, not the dataset',
  },
  {
    label: 'Measured sizing',
    value: 'fixed, variable, dynamic rows',
  },
  {
    label: 'Headless scroll',
    value: 'own the container, markup, and styles',
  },
]

const virtualDemoRows = Array.from({ length: 34 }, (_, index) => ({
  label: `Row ${index + 180}`,
  height: [34, 52, 42, 66, 38, 58, 46, 74, 40][index % 9],
}))

const featureCards = [
  {
    title: 'The DOM stays small while the list stays huge.',
    body: 'Virtual calculates the visible range, pads the scroll space, and lets you render only the items the user can actually see.',
    icon: <Eye size={18} />,
  },
  {
    title: 'Measurement handles real content.',
    body: 'Use fixed sizes when you can, measured dynamic sizes when content varies, and overscan to keep fast scrolling smooth.',
    icon: <Ruler size={18} />,
  },
  {
    title: 'Scroll containers stay product-owned.',
    body: 'Window scrolling, element scrolling, grids, lanes, sticky UI, and custom markup remain your responsibility and your freedom.',
    icon: <MousePointer2 size={18} />,
  },
  {
    title: 'It composes with the rest of the stack.',
    body: 'Pair Virtual with Table for giant grids, Query for paged data, Router for URL state, or your own renderer for anything else.',
    icon: <Sparkles size={18} />,
  },
]

const pipelineSteps = [
  {
    label: 'Count',
    body: 'Tell the virtualizer how many things exist, even if most of them are not mounted.',
  },
  {
    label: 'Estimate',
    body: 'Start from a stable size estimate so the scroll range is known immediately.',
  },
  {
    label: 'Measure',
    body: 'Let dynamic items report real sizes as content loads or expands.',
  },
  {
    label: 'Render',
    body: 'Map virtual items to your own absolutely positioned rows, cells, or cards.',
  },
]

const virtualModes = [
  {
    title: 'Vertical lists',
    body: 'Feeds, menus, logs, timelines, search results, and long admin indexes.',
    icon: <List size={18} />,
  },
  {
    title: 'Horizontal lanes',
    body: 'Calendars, kanban lanes, timelines, image strips, and dense inspectors.',
    icon: <MoveHorizontal size={18} />,
  },
  {
    title: 'Grid surfaces',
    body: 'Rows and columns that need windowing without adopting a canned grid UI.',
    icon: <Grid3X3 size={18} />,
  },
]

const frameworkAdapters = ['React', 'Vue', 'Solid', 'Svelte', 'Lit', 'Angular']

export default function VirtualLanding({
  landingCodeExampleRsc,
}: LandingComponentProps) {
  const { version } = useParams({ strict: false })
  const resolvedVersion = version ?? library.latestVersion

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-[#fbf7ff] text-zinc-950 dark:bg-zinc-950 dark:text-white">
      <section className="max-w-full overflow-hidden border-b border-purple-950/10 bg-[#f8f0ff] dark:border-purple-300/10 dark:bg-[#120818]">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-8 px-4 py-10 lg:max-w-[80rem] lg:grid-cols-[0.84fr_1.16fr] lg:items-start lg:py-12 xl:max-w-[92rem]">
          <div className="min-w-0 max-w-full sm:max-w-3xl">
            <SectionKicker icon={<StretchHorizontal size={14} />}>
              Headless virtualization
            </SectionKicker>

            <h1 className="mt-4 text-5xl font-black leading-[0.95] sm:text-6xl lg:text-7xl">
              <LibraryWordmark library={library} />
            </h1>

            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-zinc-900 dark:text-zinc-100 sm:text-xl">
              Massive scroll surfaces without massive DOM.
            </p>

            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Virtual calculates the visible window for long lists, grids, and
              scroll containers so your app can keep the markup, layout, and
              design while rendering only the work the user can see.
            </p>

            <LibraryDownloadsMicro
              animateIncreaseTrend
              library={library}
              className="mt-5"
              label="weekly downloads"
              period="weekly"
              showTotals
            />

            <p className="mt-4 max-w-xl border-l-2 border-purple-500 pl-3 text-sm font-black text-purple-800 dark:text-purple-200">
              The most popular and most used virtualization engine for modern
              web apps.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <VirtualLink
                to="/$libraryId/$version/docs"
                params={{ libraryId: library.id, version: resolvedVersion }}
                label="Read the docs"
                icon={<BookOpen size={16} aria-hidden="true" />}
              />
              <LandingCopyPromptButton
                prompt={virtualAgentPrompt}
                label="Copy Virtual Prompt"
              />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {heroProof.map((proof) => (
                <ProofPill key={proof.label} {...proof} />
              ))}
            </div>
            <LandingEcosystemProof />
          </div>

          <VirtualWindowPanel />
        </div>
      </section>

      <section className="border-b border-purple-950/10 bg-[#fcf8ff] dark:border-purple-300/10 dark:bg-[#160b1d]">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-8 px-4 py-12 lg:max-w-[80rem] lg:grid-cols-[0.74fr_1.26fr] xl:max-w-[92rem]">
          <div>
            <SectionKicker icon={<Gauge size={14} />}>
              Why Virtual
            </SectionKicker>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight sm:text-4xl">
              Performance is a layout problem before it is a rendering problem.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Virtualization is not just fewer nodes. It is scroll math,
              measurement, overscan, dynamic content, and container ownership.
              Virtual gives you those primitives without forcing a visual
              component on top.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {featureCards.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-8 px-4 py-12 lg:max-w-[80rem] lg:grid-cols-[1.05fr_0.95fr] lg:items-center xl:max-w-[92rem]">
          <PipelinePanel />
          <div>
            <SectionKicker icon={<Timer size={14} />}>
              Virtualizer lifecycle
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Keep the scroll range honest while the DOM stays lean.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Estimate first, measure when needed, then render virtual items
              into your own row, card, cell, or lane components. The API is
              small because the layout remains yours.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-[#fbfaf6] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-8 px-4 py-12 lg:max-w-[80rem] lg:grid-cols-[0.82fr_1.18fr] lg:items-start xl:max-w-[92rem]">
          <div>
            <SectionKicker icon={<BoxSelect size={14} />}>
              Scroll surfaces
            </SectionKicker>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight sm:text-4xl">
              Lists, lanes, and grids all share the same windowing idea.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
              A virtualizer is a calculation layer. Whether the output becomes a
              vertical feed, a horizontal timeline, or a two-dimensional grid,
              the product keeps control of the actual experience.
            </p>
          </div>

          <ModePanel />
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-8 px-4 py-12 lg:max-w-[80rem] lg:grid-cols-[0.72fr_1.28fr] lg:items-start xl:max-w-[92rem]">
          <div className="max-w-xl">
            <SectionKicker icon={<Scaling size={14} />}>
              Framework adapters
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              The same virtual math across UI runtimes.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Use the adapter that fits your framework, or work from the core.
              The virtual range, measurements, and scroll behavior stay focused
              on the data and container instead of the renderer.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {frameworkAdapters.map((framework) => (
                <span
                  key={framework}
                  className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-bold text-purple-800 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200"
                >
                  {framework}
                </span>
              ))}
            </div>
          </div>

          <div className="min-w-0 max-w-full overflow-hidden">
            {landingCodeExampleRsc}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[80rem] px-4 pb-12 xl:max-w-[92rem]">
          <LibraryStatsSection library={library} />
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-[#fbf7ff] py-12 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto w-full max-w-[80rem] px-4 xl:max-w-[92rem]">
          <div className="max-w-3xl">
            <SectionKicker icon={<Gauge size={14} />}>
              Field notes
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Smooth scrolling is table stakes. Owning the surface is the point.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              The existing copy had the right spirit: a tiny API for vertical,
              horizontal, and grid-style virtualization, with all the design
              control left in your hands.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <LibraryTestimonials testimonials={virtualProject.testimonials} />
        </div>
      </section>

      <section className="bg-white py-12 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-[80rem] px-4 xl:max-w-[92rem]">
          <div className="max-w-3xl">
            <SectionKicker icon={<GithubIcon className="h-4 w-4" />}>
              Open source ecosystem
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Virtual is small because the community keeps it sharp.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Maintainers, adapters, examples, partners, and GitHub sponsors
              keep the virtualization core close to real scrolling problems.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-14">
          <LazyLandingCommunitySection
            libraryId="virtual"
            libraryName="TanStack Virtual"
            showShowcases={false}
          />
          <LazySponsorSection
            title="GitHub Sponsors"
            aspectRatio="1/1"
            packMaxWidth="900px"
            showCTA
          />
        </div>
      </section>

      <LandingPageGad />
      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version: resolvedVersion },
        }}
        label="Get Started!"
        className="border-purple-500 bg-purple-500 text-white hover:bg-purple-600"
      />
      <Footer />
    </div>
  )
}

function VirtualWindowPanel() {
  const [scrollOffset, setScrollOffset] = React.useState(0)
  const viewportHeight = 218
  const overscan = 84
  const measurements = React.useMemo(() => {
    let start = 0

    return virtualDemoRows.map((row) => {
      const measurement = {
        ...row,
        start,
        end: start + row.height,
      }

      start += row.height + 8

      return measurement
    })
  }, [])
  const totalSize = measurements[measurements.length - 1]?.end ?? 0
  const maxOffset = Math.max(totalSize - viewportHeight, 0)
  const activeStart = scrollOffset
  const activeEnd = scrollOffset + viewportHeight
  const mountedRows = measurements.filter(
    (row) =>
      row.end >= activeStart - overscan && row.start <= activeEnd + overscan,
  )
  const activeRows = mountedRows.filter(
    (row) => row.end >= activeStart && row.start <= activeEnd,
  )
  const isRowMounted = (row: { end: number; start: number }) =>
    row.end >= activeStart - overscan && row.start <= activeEnd + overscan
  const isRowVisible = (row: { end: number; start: number }) =>
    row.end >= activeStart && row.start <= activeEnd

  React.useEffect(() => {
    let frameId = 0
    let startTime = 0

    const update = (time: number) => {
      if (!startTime) {
        startTime = time
      }

      const duration = 6400
      const phase = ((time - startTime) % duration) / duration
      const eased = 0.5 - Math.cos(phase * Math.PI * 2) / 2

      setScrollOffset(eased * maxOffset)
      frameId = window.requestAnimationFrame(update)
    }

    frameId = window.requestAnimationFrame(update)

    return () => window.cancelAnimationFrame(frameId)
  }, [maxOffset])

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-purple-200 bg-white p-4 shadow-sm shadow-purple-950/5 dark:border-purple-900 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-md bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-md bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-md bg-emerald-400" />
        </div>
        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
          10,000 rows / {mountedRows.length} mounted / {activeRows.length}{' '}
          visible
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.68fr_1.32fr]">
        <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-950/25">
          <p className="text-xs font-black uppercase text-purple-800 dark:text-purple-200">
            range
          </p>
          <div className="mt-3 h-80 overflow-hidden rounded-md bg-white p-2 dark:bg-zinc-950">
            <div className="relative h-full overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800">
              <div
                className="absolute left-2 right-2 z-10 rounded-md border-2 border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-950/20"
                style={{
                  height: `${(viewportHeight / totalSize) * 100}%`,
                  top: `${(scrollOffset / totalSize) * 100}%`,
                }}
              />
              {measurements.map((row) => {
                const rowMounted = isRowMounted(row)
                const rowVisible = isRowVisible(row)

                return (
                  <div
                    key={row.label}
                    className={
                      rowVisible
                        ? 'absolute left-4 right-4 rounded bg-purple-400/90 shadow-sm shadow-purple-950/30 dark:bg-purple-300/90'
                        : rowMounted
                          ? 'absolute left-4 right-4 rounded bg-zinc-400/40 dark:bg-zinc-600/70'
                          : 'absolute left-4 right-4 rounded bg-zinc-400/12 dark:bg-zinc-700/25'
                    }
                    style={{
                      height: Math.max(3, Math.min(9, row.height / 8)),
                      top: `${(row.start / totalSize) * 100}%`,
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>

        <div className="h-96 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="relative h-full overflow-hidden rounded-md bg-white dark:bg-zinc-950">
            <div
              className="absolute left-3 right-3 top-1/2 -translate-y-1/2 rounded-lg border border-purple-400/70 bg-purple-500/10 shadow-lg shadow-purple-950/20"
              style={{ height: viewportHeight }}
            />
            <div
              className="absolute left-0 right-0 will-change-transform"
              style={{
                height: totalSize,
                transform: `translateY(${-scrollOffset}px)`,
              }}
            >
              {mountedRows.map((row) => {
                const rowVisible = isRowVisible(row)

                return (
                  <div
                    key={row.label}
                    className={
                      rowVisible
                        ? 'absolute left-3 right-3 rounded-md border border-purple-400 bg-purple-500/20 px-3 py-2 shadow-sm dark:border-purple-500 dark:bg-purple-500/25'
                        : 'absolute left-3 right-3 rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'
                    }
                    style={{
                      height: row.height,
                      top: row.start,
                    }}
                  >
                    <div className="flex h-full items-center justify-between gap-3">
                      <span className="font-mono text-sm font-black">
                        {row.label}
                      </span>
                      <span
                        className={
                          rowVisible
                            ? 'text-xs font-bold text-purple-700 dark:text-purple-200'
                            : 'text-xs font-bold text-zinc-500 dark:text-zinc-400'
                        }
                      >
                        {row.height}px measured
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PipelinePanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pipelineSteps.map((step, index) => (
        <div
          key={step.label}
          className="rounded-lg border border-zinc-200 bg-[#fbf7ff] p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-sm font-black text-purple-800 dark:bg-purple-950 dark:text-purple-200">
            {index + 1}
          </span>
          <h3 className="mt-4 text-lg font-black leading-tight">
            {step.label}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {step.body}
          </p>
        </div>
      ))}
    </div>
  )
}

function ModePanel() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {virtualModes.map((mode) => (
        <div
          key={mode.title}
          className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200">
            {mode.icon}
          </span>
          <h3 className="mt-4 text-lg font-black leading-tight">
            {mode.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {mode.body}
          </p>
        </div>
      ))}
    </div>
  )
}

function FeatureCard({
  body,
  icon,
  title,
}: {
  body: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200">
        {icon}
      </span>
      <h3 className="mt-4 text-xl font-black leading-tight">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {body}
      </p>
    </div>
  )
}

function SectionKicker({
  children,
  icon,
}: {
  children: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <p className="inline-flex items-center gap-2 text-sm font-black uppercase text-purple-700 dark:text-purple-300">
      {icon}
      {children}
    </p>
  )
}

function ProofPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-purple-500 pl-3">
      <p className="text-sm font-black text-zinc-950 dark:text-white">
        {label}
      </p>
      <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
        {value}
      </p>
    </div>
  )
}

function VirtualLink({
  icon,
  label,
  params,
  to,
}: {
  icon: React.ReactNode
  label: string
  params: Record<string, string>
  to: string
}) {
  return (
    <Link
      to={to}
      params={params}
      className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-lg border border-zinc-950 bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:w-auto"
    >
      {icon}
      {label}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  )
}
