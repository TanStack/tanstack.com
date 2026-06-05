import * as React from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Columns3,
  EyeOff,
  Filter,
  Grid3X3,
  Layers,
  MoveHorizontal,
  Rows3,
  Scaling,
  SlidersHorizontal,
  Sparkles,
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
import { tableProject } from '~/libraries/table'
import type { LandingComponentProps } from '~/routes/$libraryId/$version'

import { LandingEcosystemProof } from '~/components/landing/LandingEcosystemProof'
import { LandingCopyPromptButton } from '~/components/landing/LandingCopyPromptButton'
const library = getLibrary('table')
const tableAgentPrompt = [
  'Build a TanStack Table data grid for a TypeScript app.',
  'Keep the table headless: define column defs, row models, sorting, filtering, pagination, selection, column visibility, and controlled state without prescribing markup.',
  'Render accessible table markup and show how table state can be owned by the product UI or synchronized to URL/server state when needed.',
].join(' ')

const heroProof = [
  {
    label: 'Headless engine',
    value: 'bring your markup, styles, and components',
  },
  {
    label: 'Row models',
    value: 'sort, filter, group, expand, paginate',
  },
  {
    label: 'Controlled state',
    value: 'own every toggle, filter, and selection',
  },
]

const tableColumns = [
  { key: 'name', label: 'Project', width: 'w-[34%]' },
  { key: 'status', label: 'Status', width: 'w-[20%]' },
  { key: 'owner', label: 'Owner', width: 'w-[22%]' },
  { key: 'score', label: 'Score', width: 'w-[24%]' },
]

const tableRows = [
  ['Router docs', 'active', 'Tanner', '98'],
  ['Query cache', 'review', 'Dominik', '94'],
  ['Table filters', 'shipped', 'Kevin', '91'],
  ['Virtual lists', 'active', 'Ben', '88'],
]

const pipelineSteps = [
  {
    label: 'Columns',
    body: 'Column defs describe accessors, headers, cells, metadata, and feature behavior without owning your DOM.',
    icon: <Columns3 size={18} />,
  },
  {
    label: 'Rows',
    body: 'Core, filtered, sorted, grouped, expanded, and paginated row models compose into the exact data shape you need.',
    icon: <Rows3 size={18} />,
  },
  {
    label: 'State',
    body: 'Let Table manage state by default, then control the pieces your product needs to own.',
    icon: <SlidersHorizontal size={18} />,
  },
  {
    label: 'Markup',
    body: 'Render semantic tables, card grids, virtualized panes, or spreadsheet-like layouts from the same engine.',
    icon: <Grid3X3 size={18} />,
  },
]

const featureCards = [
  {
    title: 'Headless means the designer still wins.',
    body: 'Table gives you the math and state. Your app keeps the elements, classes, interactions, density, empty states, and brand-specific details.',
    icon: <Sparkles size={18} />,
  },
  {
    title: 'Feature power without a grid tax.',
    body: 'Sorting, filtering, faceting, grouping, aggregation, expansion, selection, sizing, pinning, visibility, ordering, and pagination are opt-in row models.',
    icon: <Boxes size={18} />,
  },
  {
    title: 'Server-side data is not an afterthought.',
    body: 'Pagination, sorting, and filters can be local, controlled, URL-driven, or backed by your API. Table does not assume where the data lives.',
    icon: <Filter size={18} />,
  },
  {
    title: 'Virtualization stays your choice.',
    body: 'Pair with TanStack Virtual when the table needs huge rows or columns, without turning the table engine into a scroll container framework.',
    icon: <Scaling size={18} />,
  },
]

const stateControls = [
  {
    label: 'sorting',
    value: '[{ id: "score", desc: true }]',
  },
  {
    label: 'columnVisibility',
    value: '{ owner: false }',
  },
  {
    label: 'rowSelection',
    value: '{ "issue-42": true }',
  },
  {
    label: 'pagination',
    value: '{ pageIndex: 2, pageSize: 25 }',
  },
]

const frameworkAdapters = [
  'React',
  'Vue',
  'Solid',
  'Svelte',
  'Qwik',
  'Angular',
  'Lit',
  'Alpine',
  'Vanilla',
]

export default function TableLanding({
  landingCodeExampleRsc,
}: LandingComponentProps) {
  const { version } = useParams({ strict: false })
  const resolvedVersion = version ?? library.latestVersion

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-[#f4f9ff] text-zinc-950 dark:bg-zinc-950 dark:text-white">
      <section className="max-w-full overflow-hidden border-b border-blue-950/10 bg-[#eef7ff] dark:border-blue-300/10 dark:bg-[#06101a]">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-8 px-4 py-10 lg:max-w-[80rem] lg:grid-cols-[0.84fr_1.16fr] lg:items-start lg:py-12 xl:max-w-[92rem]">
          <div className="min-w-0 max-w-full sm:max-w-3xl">
            <SectionKicker icon={<Grid3X3 size={14} />}>
              Headless table engine
            </SectionKicker>

            <h1 className="mt-4 text-5xl font-black leading-[0.95] sm:text-6xl lg:text-7xl">
              <LibraryWordmark library={library} />
            </h1>

            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-zinc-900 dark:text-zinc-100 sm:text-xl">
              Build the table you actually designed.
            </p>

            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Table is the headless engine for rows, columns, sorting,
              filtering, grouping, pagination, selection, and controlled state.
              It gives you the hard parts of a data grid without taking over the
              markup.
            </p>

            <LibraryDownloadsMicro
              animateIncreaseTrend
              library={library}
              className="mt-5"
              label="weekly downloads"
              period="weekly"
              showTotals
            />

            <p className="mt-4 max-w-xl border-l-2 border-blue-500 pl-3 text-sm font-black text-blue-800 dark:text-blue-200">
              The most popular and most used data grid engine in the world.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <TableLink
                to="/$libraryId/$version/docs"
                params={{ libraryId: library.id, version: resolvedVersion }}
                label="Read the docs"
                icon={<BookOpen size={16} aria-hidden="true" />}
              />
              <LandingCopyPromptButton
                prompt={tableAgentPrompt}
                label="Copy Table Prompt"
              />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {heroProof.map((proof) => (
                <ProofPill key={proof.label} {...proof} />
              ))}
            </div>
            <LandingEcosystemProof />
          </div>

          <TableWorkbenchPanel />
        </div>
      </section>

      <section className="border-b border-blue-950/10 bg-[#f8fbff] dark:border-blue-300/10 dark:bg-[#08131f]">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-8 px-4 py-12 lg:max-w-[80rem] lg:grid-cols-[0.74fr_1.26fr] xl:max-w-[92rem]">
          <div>
            <SectionKicker icon={<Layers size={14} />}>Why Table</SectionKicker>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight sm:text-4xl">
              A data grid should not decide your UI system.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Most table libraries sell a finished component. TanStack Table
              sells the engine underneath it, so your product can keep its own
              design language, interaction model, accessibility choices, and
              performance strategy.
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
            <SectionKicker icon={<MoveHorizontal size={14} />}>
              Row model pipeline
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Compose the exact table behavior the product needs.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Start with core rows, then opt into filtering, sorting, grouping,
              expansion, pagination, selection, column sizing, and visibility.
              Every feature is explicit, and every state slice can be
              controlled.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-[#fbfaf6] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-8 px-4 py-12 lg:max-w-[80rem] lg:grid-cols-[0.82fr_1.18fr] lg:items-start xl:max-w-[92rem]">
          <div>
            <SectionKicker icon={<SlidersHorizontal size={14} />}>
              Controlled state
            </SectionKicker>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight sm:text-4xl">
              Own the table state that matters.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Keep internal state for quick prototypes, then lift sorting,
              filters, pagination, selection, visibility, sizing, or ordering
              into your app when the product needs URL state, server queries, or
              saved user preferences.
            </p>
          </div>

          <ControlledStatePanel />
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-8 px-4 py-12 lg:max-w-[80rem] lg:grid-cols-[0.72fr_1.28fr] lg:items-start xl:max-w-[92rem]">
          <div className="max-w-xl">
            <SectionKicker icon={<Grid3X3 size={14} />}>
              Framework adapters
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              One table core, every renderer.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              The table model is framework agnostic. Use the adapter that fits
              the UI runtime, keep the same column definitions and feature
              strategy, and render the table with your own components.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {frameworkAdapters.map((framework) => (
                <span
                  key={framework}
                  className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
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

      <section className="border-b border-zinc-200 bg-[#f4f9ff] py-12 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto w-full max-w-[80rem] px-4 xl:max-w-[92rem]">
          <div className="max-w-3xl">
            <SectionKicker icon={<EyeOff size={14} />}>
              Field notes
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              The best Table examples do not look alike.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              That is the point. TanStack Table powers shadcn-style data tables,
              accessible React Aria tables, dense admin grids, custom filters,
              and spreadsheet-like product surfaces because it stays below the
              visual layer.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <LibraryTestimonials testimonials={tableProject.testimonials} />
        </div>
      </section>

      <section className="bg-white py-12 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-[80rem] px-4 xl:max-w-[92rem]">
          <div className="max-w-3xl">
            <SectionKicker icon={<GithubIcon className="h-4 w-4" />}>
              Open source ecosystem
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Table is shaped by the people building serious tables.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Maintainers, framework adapters, partner integrations, examples,
              and GitHub sponsors all keep the table engine close to real
              product work.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-14">
          <LazyLandingCommunitySection
            libraryId="table"
            libraryName="TanStack Table"
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
        className="border-blue-500 bg-blue-500 text-white hover:bg-blue-600"
      />
      <Footer />
    </div>
  )
}

function TableWorkbenchPanel() {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-blue-200 bg-white p-4 shadow-sm shadow-blue-950/5 dark:border-blue-900 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-md bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-md bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-md bg-emerald-400" />
        </div>
        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
          table instance
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex border-b border-zinc-200 bg-blue-50 text-xs font-black uppercase text-blue-950 dark:border-zinc-800 dark:bg-blue-950/30 dark:text-blue-100">
          {tableColumns.map((column) => (
            <div key={column.key} className={`${column.width} px-3 py-2`}>
              {column.label}
            </div>
          ))}
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {tableRows.map((row) => (
            <div
              key={row.join(':')}
              className="flex bg-white text-sm dark:bg-zinc-950"
            >
              {row.map((cell, index) => (
                <div
                  key={cell}
                  className={`${tableColumns[index]?.width ?? 'w-1/4'} min-w-0 px-3 py-3`}
                >
                  <span className="block truncate font-bold text-zinc-900 dark:text-zinc-100">
                    {cell}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ['Filtered', 'status: active'],
          ['Sorted', 'score desc'],
          ['Selected', '2 rows'],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/25"
          >
            <p className="text-[0.65rem] font-black uppercase text-blue-700 dark:text-blue-300">
              {label}
            </p>
            <p className="mt-1 text-sm font-black text-blue-950 dark:text-blue-100">
              {value}
            </p>
          </div>
        ))}
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
          className="rounded-lg border border-zinc-200 bg-[#f8fbff] p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              {step.icon}
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-[0.65rem] font-black uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {index + 1}
            </span>
          </div>
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

function ControlledStatePanel() {
  return (
    <div className="min-w-0 rounded-lg border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-zinc-950">
      <div className="rounded-lg bg-zinc-950 p-4 text-sm text-blue-100 dark:bg-black">
        <p className="font-mono leading-6">
          state: {'{'}
          <br />
          &nbsp;&nbsp;sorting,
          <br />
          &nbsp;&nbsp;columnVisibility,
          <br />
          &nbsp;&nbsp;rowSelection,
          <br />
          &nbsp;&nbsp;pagination
          <br />
          {'}'}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {stateControls.map((control) => (
          <div
            key={control.label}
            className="rounded-lg border border-zinc-200 bg-[#f8fbff] p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-[0.65rem] font-black uppercase text-zinc-500 dark:text-zinc-400">
              {control.label}
            </p>
            <p className="mt-2 break-words font-mono text-sm font-black leading-6 text-zinc-950 dark:text-white">
              {control.value}
            </p>
          </div>
        ))}
      </div>
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
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
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
    <p className="inline-flex items-center gap-2 text-sm font-black uppercase text-blue-700 dark:text-blue-300">
      {icon}
      {children}
    </p>
  )
}

function ProofPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-blue-500 pl-3">
      <p className="text-sm font-black text-zinc-950 dark:text-white">
        {label}
      </p>
      <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
        {value}
      </p>
    </div>
  )
}

function TableLink({
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
