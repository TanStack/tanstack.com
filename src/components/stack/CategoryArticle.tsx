import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import {
  ArrowRight,
  Blocks,
  Braces,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Keyboard,
  Layers,
  Newspaper,
  PackageCheck,
  Rocket,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table as TableIcon,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react'

import { DeferredApplicationStarter } from '~/components/DeferredApplicationStarter'
import { LibraryWordmark } from '~/components/LibraryWordmark'
import type { LibrarySlim } from '~/libraries'
import { formatPublishedDate, getPostsForLibrary } from '~/utils/blog'
import {
  categoryMeta,
  getCategoryLibraries,
  type CategorySlug,
} from './stack-categories'

type RelatedPost = {
  post: { slug: string; title: string; published: string; excerpt?: string }
  lib: LibrarySlim
}

const heroTitleClassName =
  'mt-4 text-3xl font-black leading-[1.04] sm:text-4xl lg:text-5xl'

export function CategoryArticle({ slug }: { slug: CategorySlug }) {
  const meta = categoryMeta[slug]
  const libraries = getCategoryLibraries(slug)
  const relatedPosts = getRelatedPosts(libraries)

  return (
    <div className="bg-[#f7f5ef] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <Breadcrumb categoryName={meta.name} />

      {slug === 'framework' ? (
        <FrameworkCategory libraries={libraries} relatedPosts={relatedPosts} />
      ) : null}
      {slug === 'state' ? (
        <StateCategory libraries={libraries} relatedPosts={relatedPosts} />
      ) : null}
      {slug === 'ui' ? (
        <UiCategory libraries={libraries} relatedPosts={relatedPosts} />
      ) : null}
      {slug === 'performance' ? (
        <PerformanceCategory
          libraries={libraries}
          relatedPosts={relatedPosts}
        />
      ) : null}
      {slug === 'tooling' ? (
        <ToolingCategory libraries={libraries} relatedPosts={relatedPosts} />
      ) : null}
    </div>
  )
}

function getRelatedPosts(libraries: Array<LibrarySlim>) {
  return libraries
    .flatMap((lib) => getPostsForLibrary(lib.id).map((post) => ({ post, lib })))
    .slice(0, 4)
}

function Breadcrumb({ categoryName }: { categoryName: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400">
        <Link to="/" className="hover:text-zinc-950 dark:hover:text-white">
          Home
        </Link>
        <ChevronRight size={12} aria-hidden="true" />
        <Link
          to="/libraries"
          className="hover:text-zinc-950 dark:hover:text-white"
        >
          Libraries
        </Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {categoryName}
        </span>
      </div>
    </nav>
  )
}

function FrameworkCategory({
  libraries,
  relatedPosts,
}: {
  libraries: Array<LibrarySlim>
  relatedPosts: Array<RelatedPost>
}) {
  const start = getLibraryById(libraries, 'start')
  const router = getLibraryById(libraries, 'router')

  return (
    <>
      <section className="border-b border-cyan-950/10 bg-[#f6fbfb] dark:border-cyan-300/10 dark:bg-[#041010]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-start lg:py-12">
          <div className="max-w-3xl">
            <SectionKicker icon={<Sparkles size={14} />}>
              Framework
            </SectionKicker>
            <h1 className={heroTitleClassName}>
              Router-first apps, from SPA to full-stack.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Start begins where Router leaves off: the same typed route tree,
              URL state, loaders, links, and prefetching, with full-document
              SSR, streaming, server functions, server routes, and deployable
              output added around it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LibraryButton library={start} label="Explore Start" />
              <LibraryButton library={router} label="Explore Router" muted />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['Built on Router', 'Routes, search, loaders, links'],
                [
                  'Client-authored, server-powered',
                  'SSR, streaming, server functions',
                ],
                ['Portable output', 'Cloudflare, Railway, Netlify ready'],
              ].map(([label, detail]) => (
                <div key={label} className="border-l-2 border-cyan-500/70 pl-3">
                  <p className="text-sm font-bold text-zinc-950 dark:text-white">
                    {label}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
                    {detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-cyan-950/10 bg-white p-3 shadow-sm shadow-cyan-950/5 dark:border-cyan-300/15 dark:bg-zinc-950">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <p className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                  Application builder
                </p>
                <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                  Turn a product brief into a Start-ready stack.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">
                <Rocket size={13} aria-hidden="true" />
                Start-first
              </span>
            </div>
            <DeferredApplicationStarter
              context="start"
              mode="compact"
              primaryActionLabel="Generate Start prompt"
              secondaryActionLabel="Build Start app on Netlify"
              title="Describe the app you want to build"
              tone="cyan"
            />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-950">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <Link
            to={start.to ?? '#'}
            className="group rounded-lg border border-cyan-200 bg-cyan-50 p-6 transition-colors hover:border-cyan-300 dark:border-cyan-900/70 dark:bg-cyan-950/20 dark:hover:border-cyan-700"
          >
            <LibraryTitle library={start} overline="Lead library" />
            <h2 className="mt-5 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">
              <LibraryWordmark library={start} includeTanStack={false} /> takes
              the route tree all the way to production.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Full-document SSR, server functions, streaming, deployment
              adapters, bundling, and conventions live here. It is the answer
              when the app is more than a client router with a data layer.
            </p>
            <div className="mt-7 grid gap-2 sm:grid-cols-3">
              {['Server functions', 'Streaming', 'Deployable output'].map(
                (label) => (
                  <div
                    key={label}
                    className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-cyan-900 dark:bg-zinc-950 dark:text-cyan-200"
                  >
                    {label}
                  </div>
                ),
              )}
            </div>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-cyan-800 group-hover:text-cyan-950 dark:text-cyan-200 dark:group-hover:text-white">
              Open Start <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>

          <div className="rounded-lg border border-emerald-200 bg-[#f5fbf6] p-6 dark:border-emerald-900/70 dark:bg-emerald-950/10">
            <LibraryTitle library={router} overline="Foundation" />
            <div className="mt-5 rounded-lg border border-emerald-200 bg-white p-4 font-mono text-xs leading-6 text-zinc-700 dark:border-emerald-900 dark:bg-zinc-950 dark:text-zinc-300">
              {[
                'routes/__root.tsx',
                'routes/index.tsx',
                'routes/projects.$id.tsx',
                'loader: typed project query',
                'search: validated filters',
              ].map((line, index) => (
                <div key={line} className="flex items-center gap-3">
                  <span className="w-5 text-right text-emerald-600 dark:text-emerald-400">
                    {index + 1}
                  </span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Router keeps Start grounded: generated route maps, nested layouts,
              loaders that start before render, validated search params, and
              navigation APIs that carry types through every link.
            </p>
            <LibraryButton library={router} label="Open Router" muted />
          </div>
        </div>
      </section>

      <RelatedPostsBlock items={relatedPosts} />
    </>
  )
}

function StateCategory({
  libraries,
  relatedPosts,
}: {
  libraries: Array<LibrarySlim>
  relatedPosts: Array<RelatedPost>
}) {
  const query = getLibraryById(libraries, 'query')
  const db = getLibraryById(libraries, 'db')
  const store = getLibraryById(libraries, 'store')
  const ai = getLibraryById(libraries, 'ai')

  return (
    <>
      <section className="border-b border-zinc-200 bg-[#fbfaf6] dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <SectionKicker icon={<Database size={14} />}>
              Data & State Management
            </SectionKicker>
            <h1 className={heroTitleClassName}>
              The right state layer for every kind of data.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Query gives server state a cache and lifecycle, DB turns synced
              API data into live collections, Store keeps local state tiny and
              reactive, and AI makes provider work feel typed instead of
              vendor-shaped.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid gap-3">
              {[
                {
                  library: query,
                  label: 'Cache',
                  detail: 'freshness, retries, invalidation',
                },
                {
                  library: db,
                  label: 'Collect',
                  detail: 'live queries, optimistic writes',
                },
                {
                  library: store,
                  label: 'Signal',
                  detail: 'selectors, derived state, adapters',
                },
                {
                  library: ai,
                  label: 'Model',
                  detail: 'providers, tools, AG-UI streams',
                },
              ].map(({ library, label, detail }) => (
                <div
                  key={library.id}
                  className="grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-[7rem_1fr_auto] sm:items-center"
                >
                  <div
                    className={twMerge(
                      'inline-flex w-fit items-center rounded-md bg-gradient-to-r px-2.5 py-1 text-sm font-black text-white',
                      library.colorFrom,
                      library.colorTo,
                    )}
                  >
                    {label}
                  </div>
                  <div>
                    <p className="font-bold">
                      <LibraryWordmark
                        library={library}
                        includeTanStack={false}
                      />
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {detail}
                    </p>
                  </div>
                  <ArrowRight
                    className="hidden text-zinc-400 sm:block"
                    size={16}
                    aria-hidden="true"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="max-w-3xl">
            <SectionKicker icon={<Layers size={14} />}>
              Equal parts of the stack
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Pick the layer by the kind of truth you need to preserve.
            </h2>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <StateLibraryCard
              library={query}
              title="Server truth that can go stale"
              body="Use Query when the data lives somewhere else and needs freshness, retries, dedupe, background refetching, mutation lifecycle, and targeted invalidation without becoming hand-written state machinery."
              sample={[
                'useQuery(projectOptions)',
                'invalidate todos',
                'optimistic update',
              ]}
            />
            <StateLibraryCard
              library={db}
              title="Client collections that stay alive"
              body="Use DB when the UI wants local-first reads, live query results, optimistic mutations, and a collection model that can reconcile with an API."
              sample={[
                'collection.insert()',
                'liveQuery(filters)',
                'transaction.commit()',
              ]}
            />
            <StateLibraryCard
              library={store}
              title="Local state with a small core"
              body="Use Store when state is already in the client and the winning move is a tiny reactive primitive with adapters instead of another app framework."
              sample={[
                'store.setState()',
                'derived selector',
                'framework adapter',
              ]}
            />
            <StateLibraryCard
              library={ai}
              title="Provider work without vendor gravity"
              body="Use AI when providers, tools, structured output, streams, AG-UI events, and model differences should be represented in clean TypeScript instead of leaking through the app."
              sample={['stream output', 'tool call schema', 'AG-UI event']}
            />
          </div>
        </div>
      </section>

      <RelatedPostsBlock items={relatedPosts} />
    </>
  )
}

function StateLibraryCard({
  body,
  library,
  sample,
  title,
}: {
  body: string
  library: LibrarySlim
  sample: Array<string>
  title: string
}) {
  return (
    <Link
      to={library.to ?? '#'}
      className="group rounded-lg border border-zinc-200 bg-[#fbfaf7] p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <LibraryTitle library={library} />
      <h3 className="mt-4 text-2xl font-black leading-tight">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {body}
      </p>
      <div className="mt-5 grid gap-2">
        {sample.map((line) => (
          <div
            key={line}
            className="rounded-md bg-white px-3 py-2 font-mono text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300"
          >
            {line}
          </div>
        ))}
      </div>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-zinc-700 group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-white">
        Open{' '}
        <LibraryWordmark
          library={library}
          includeTanStack={false}
          colorProduct={false}
        />{' '}
        <ArrowRight size={15} aria-hidden="true" />
      </span>
    </Link>
  )
}

function UiCategory({
  libraries,
  relatedPosts,
}: {
  libraries: Array<LibrarySlim>
  relatedPosts: Array<RelatedPost>
}) {
  const table = getLibraryById(libraries, 'table')
  const form = getLibraryById(libraries, 'form')
  const hotkeys = getLibraryById(libraries, 'hotkeys')

  return (
    <>
      <section className="border-b border-zinc-200 bg-[#f8faf9] dark:border-zinc-800 dark:bg-[#090b0d]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionKicker icon={<TableIcon size={14} />}>
              UI & UX
            </SectionKicker>
            <h1 className={heroTitleClassName}>
              Headless engines for the UI users actually touch.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Table, Form, and Hotkeys stay out of your markup and styling
              decisions while giving the interaction model a serious engine: row
              models, field subscriptions, validation, shortcut scopes, and type
              safety.
            </p>
          </div>

          <InteractionWorkbench form={form} hotkeys={hotkeys} table={table} />
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="max-w-3xl">
            <SectionKicker icon={<Blocks size={14} />}>
              Surface by surface
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              The UI stays yours. The hard interaction state does not have to.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <UiSurfaceCard
              detail="Compose sorting, filtering, grouping, sizing, pagination, selection, and virtualization without accepting a prebuilt table skin."
              icon={<TableIcon size={18} />}
              library={table}
              sample={<TableSample />}
              title="Data density"
            />
            <UiSurfaceCard
              detail="Model fields, validation, submission, async checks, and fine-grained field subscriptions while keeping every input under your control."
              icon={<SlidersHorizontal size={18} />}
              library={form}
              sample={<FormSample />}
              title="Input confidence"
            />
            <UiSurfaceCard
              detail="Compose scopes, shortcuts, sequences, key state, and command surfaces for apps that reward fluent operators."
              icon={<Keyboard size={18} />}
              library={hotkeys}
              sample={<HotkeysSample />}
              title="Keyboard flow"
            />
          </div>
        </div>
      </section>

      <RelatedPostsBlock items={relatedPosts} />
    </>
  )
}

function InteractionWorkbench({
  form,
  hotkeys,
  table,
}: {
  form: LibrarySlim
  hotkeys: LibrarySlim
  table: LibrarySlim
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
          <LibraryTitle library={table} overline="Grid state" />
          <TableSample />
        </div>
        <div className="grid gap-4">
          <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/20">
            <LibraryTitle library={form} overline="Input state" />
            <FormSample />
          </div>
          <div className="rounded-lg bg-rose-50 p-4 dark:bg-rose-950/20">
            <LibraryTitle library={hotkeys} overline="Command state" />
            <HotkeysSample />
          </div>
        </div>
      </div>
    </div>
  )
}

function UiSurfaceCard({
  detail,
  icon,
  library,
  sample,
  title,
}: {
  detail: string
  icon: React.ReactNode
  library: LibrarySlim
  sample: React.ReactNode
  title: string
}) {
  return (
    <Link
      to={library.to ?? '#'}
      className="group flex flex-col rounded-lg border border-zinc-200 bg-[#fbfaf7] p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-center justify-between gap-3">
        <LibraryTitle library={library} overline={title} />
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          {icon}
        </span>
      </div>
      <div className="mt-5">{sample}</div>
      <p className="mt-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {detail}
      </p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-zinc-700 group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-white">
        Open{' '}
        <LibraryWordmark
          library={library}
          includeTanStack={false}
          colorProduct={false}
        />{' '}
        <ArrowRight size={15} aria-hidden="true" />
      </span>
    </Link>
  )
}

function TableSample() {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-blue-200 bg-white text-xs dark:border-blue-900 dark:bg-zinc-950">
      <div className="grid grid-cols-3 bg-blue-100 font-bold text-blue-950 dark:bg-blue-950/60 dark:text-blue-100">
        {['Name', 'Status', 'MRR'].map((heading) => (
          <div key={heading} className="px-3 py-2">
            {heading}
          </div>
        ))}
      </div>
      {[
        ['Acme', 'Active', '$12k'],
        ['Orbit', 'Trial', '$4k'],
        ['North', 'Active', '$8k'],
      ].map((row) => (
        <div
          key={row.join(':')}
          className="grid grid-cols-3 border-t border-blue-100 text-zinc-600 dark:border-blue-900/60 dark:text-zinc-300"
        >
          {row.map((cell) => (
            <div key={cell} className="px-3 py-2">
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function FormSample() {
  return (
    <div className="mt-4 space-y-2 text-xs">
      {[
        ['Email', 'team@tanstack.com'],
        ['Plan', 'Startup'],
      ].map(([label, value]) => (
        <div key={label}>
          <p className="mb-1 font-semibold text-yellow-800 dark:text-yellow-200">
            {label}
          </p>
          <div className="rounded-md border border-yellow-200 bg-white px-3 py-2 text-zinc-600 dark:border-yellow-900 dark:bg-zinc-950 dark:text-zinc-300">
            {value}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-yellow-800 dark:text-yellow-200">
        <CheckCircle2 size={14} aria-hidden="true" />
        Schema and field state agree
      </div>
    </div>
  )
}

function HotkeysSample() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
      {['Cmd', 'K', 'then', 'P'].map((key) => (
        <span
          key={key}
          className="rounded-md border border-rose-200 bg-white px-2.5 py-2 font-bold text-rose-800 shadow-sm dark:border-rose-900 dark:bg-zinc-950 dark:text-rose-200"
        >
          {key}
        </span>
      ))}
      <span className="basis-full text-rose-800 dark:text-rose-200">
        Sequence opens project switcher
      </span>
    </div>
  )
}

function PerformanceCategory({
  libraries,
  relatedPosts,
}: {
  libraries: Array<LibrarySlim>
  relatedPosts: Array<RelatedPost>
}) {
  const virtual = getLibraryById(libraries, 'virtual')
  const pacer = getLibraryById(libraries, 'pacer')

  return (
    <>
      <section className="border-b border-zinc-200 bg-[#fafaf4] dark:border-zinc-800 dark:bg-[#0b0d08]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionKicker icon={<Zap size={14} />}>Performance</SectionKicker>
            <h1 className={heroTitleClassName}>
              Render less, schedule less, stay fast.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Virtual keeps long interfaces from flooding the DOM. Pacer shapes
              expensive event streams with debouncing, throttling, queues,
              batching, and rate limits. Together they protect the user’s next
              frame.
            </p>
          </div>

          <FrameBudgetLab pacer={pacer} virtual={virtual} />
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="grid gap-4 lg:grid-cols-2">
            <PerformanceLibraryPanel
              body="Render the slice the user can see, measure what changes, and leave the DOM calm even when the dataset is loud."
              library={virtual}
              points={[
                'Windowed rows',
                'Dynamic measurement',
                'Framework adapters',
              ]}
              title="Virtual reduces the visible work."
            />
            <PerformanceLibraryPanel
              body="Give event-heavy surfaces a scheduler: debounce typing, throttle scroll, queue writes, batch bursts, and rate-limit APIs."
              library={pacer}
              points={[
                'Debounce and throttle',
                'Queues and batching',
                'Rate limits',
              ]}
              title="Pacer shapes time before it reaches work."
            />
          </div>
        </div>
      </section>

      <RelatedPostsBlock items={relatedPosts} />
    </>
  )
}

function FrameBudgetLab({
  pacer,
  virtual,
}: {
  pacer: LibrarySlim
  virtual: LibrarySlim
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="font-bold">16ms frame lab</p>
        <Clock3 className="text-lime-700 dark:text-lime-300" size={18} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-950/20">
          <LibraryTitle library={virtual} overline="DOM pressure" />
          <div className="mt-4 space-y-1.5">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className={twMerge(
                  'h-7 rounded-md border px-3 text-xs leading-7',
                  index > 1 && index < 5
                    ? 'border-purple-300 bg-white text-purple-900 dark:border-purple-700 dark:bg-zinc-950 dark:text-purple-100'
                    : 'border-purple-100 bg-purple-100/70 text-purple-400 dark:border-purple-900/60 dark:bg-purple-950/20 dark:text-purple-500',
                )}
              >
                row {index + 121}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-lime-50 p-4 dark:bg-lime-950/20">
          <LibraryTitle library={pacer} overline="Event pressure" />
          <div className="mt-4 space-y-3">
            {[
              ['input burst', 'debounce'],
              ['scroll stream', 'throttle'],
              ['write queue', 'batch'],
            ].map(([event, action]) => (
              <div
                key={event}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md bg-white px-3 py-2 text-xs dark:bg-zinc-950"
              >
                <span className="text-zinc-600 dark:text-zinc-300">
                  {event}
                </span>
                <span className="rounded-md bg-lime-100 px-2 py-1 font-bold text-lime-800 dark:bg-lime-950 dark:text-lime-200">
                  {action}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PerformanceLibraryPanel({
  body,
  library,
  points,
  title,
}: {
  body: string
  library: LibrarySlim
  points: Array<string>
  title: string
}) {
  return (
    <Link
      to={library.to ?? '#'}
      className="group rounded-lg border border-zinc-200 bg-[#fbfaf7] p-6 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <LibraryTitle library={library} />
      <h2 className="mt-4 text-3xl font-black leading-tight">
        <LibraryLeadTitle library={library} title={title} />
      </h2>
      <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
        {body}
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {points.map((point) => (
          <div
            key={point}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
          >
            {point}
          </div>
        ))}
      </div>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-zinc-700 group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-white">
        Open{' '}
        <LibraryWordmark
          library={library}
          includeTanStack={false}
          colorProduct={false}
        />{' '}
        <ArrowRight size={15} aria-hidden="true" />
      </span>
    </Link>
  )
}

function LibraryLeadTitle({
  library,
  title,
}: {
  library: LibrarySlim
  title: string
}) {
  const productName = shortName(library)

  if (!title.startsWith(productName)) {
    return <>{title}</>
  }

  return (
    <>
      <LibraryWordmark library={library} includeTanStack={false} />
      {title.slice(productName.length)}
    </>
  )
}

function ToolingCategory({
  libraries,
  relatedPosts,
}: {
  libraries: Array<LibrarySlim>
  relatedPosts: Array<RelatedPost>
}) {
  const devtools = getLibraryById(libraries, 'devtools')
  const config = getLibraryById(libraries, 'config')
  const cli = getLibraryById(libraries, 'cli')
  const intent = getLibraryById(libraries, 'intent')

  return (
    <>
      <section className="border-b border-zinc-200 bg-[#f8f7f2] dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <SectionKicker icon={<Wrench size={14} />}>Tooling</SectionKicker>
            <h1 className={heroTitleClassName}>
              The tools around TanStack apps and packages.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Devtools exposes what your TanStack libraries are doing, Config
              standardizes how packages ship, CLI creates and connects projects,
              and Intent packages durable guidance for AI agents beside npm
              packages.
            </p>
          </div>

          <ToolingWorkbench
            cli={cli}
            config={config}
            devtools={devtools}
            intent={intent}
          />
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="max-w-3xl">
            <SectionKicker icon={<PackageCheck size={14} />}>
              Ship path
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              From first command to inspected runtime to package-level memory.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            <ToolingStep
              detail="Create Start apps, search docs, export prompts, and connect the project to TanStack-aware workflows."
              icon={<Terminal size={18} />}
              library={cli}
              step="Create"
            />
            <ToolingStep
              detail="Lint, build, test, version, and publish JavaScript packages with fewer bespoke decisions."
              icon={<PackageCheck size={18} />}
              library={config}
              step="Package"
            />
            <ToolingStep
              detail="Inspect TanStack libraries through one dockable panel and bring custom devtools along for the ride."
              icon={<Search size={18} />}
              library={devtools}
              step="Inspect"
            />
            <ToolingStep
              detail="Ship agent skills beside npm packages so assistants can discover current guidance from dependencies."
              icon={<Braces size={18} />}
              library={intent}
              step="Remember"
            />
          </div>
        </div>
      </section>

      <RelatedPostsBlock items={relatedPosts} />
    </>
  )
}

function ToolingWorkbench({
  cli,
  config,
  devtools,
  intent,
}: {
  cli: LibrarySlim
  config: LibrarySlim
  devtools: LibrarySlim
  intent: LibrarySlim
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-white shadow-sm shadow-zinc-950/10 dark:border-zinc-800">
      <div className="mb-4 flex items-center gap-2 text-sm text-zinc-400">
        <span className="h-2.5 w-2.5 rounded-md bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-md bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-md bg-emerald-400" />
        <span className="ml-2 font-mono">tanstack-workbench</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <WorkbenchCell
          code={['pnpm dlx @tanstack/cli init', 'template: start + query']}
          icon={<Terminal size={16} />}
          library={cli}
        />
        <WorkbenchCell
          code={['config extends tanstack', 'publish: changesets ready']}
          icon={<PackageCheck size={16} />}
          library={config}
        />
        <WorkbenchCell
          code={['panel: router + query', 'custom dock: app metrics']}
          icon={<Search size={16} />}
          library={devtools}
        />
        <WorkbenchCell
          code={['intent skills installed', 'agent context: package-scoped']}
          icon={<Braces size={16} />}
          library={intent}
        />
      </div>
    </div>
  )
}

function WorkbenchCell({
  code,
  icon,
  library,
}: {
  code: Array<string>
  icon: React.ReactNode
  library: LibrarySlim
}) {
  return (
    <Link
      to={library.to ?? '#'}
      className="group rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/25"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          {icon}
          <LibraryWordmark
            library={library}
            includeTanStack={false}
            colorProduct={false}
            className="text-white"
          />
        </span>
        <ArrowRight
          size={14}
          className="text-zinc-500 group-hover:text-white"
          aria-hidden="true"
        />
      </div>
      <div className="mt-4 space-y-1 font-mono text-xs text-zinc-300">
        {code.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </Link>
  )
}

function ToolingStep({
  detail,
  icon,
  library,
  step,
}: {
  detail: string
  icon: React.ReactNode
  library: LibrarySlim
  step: string
}) {
  return (
    <Link
      to={library.to ?? '#'}
      className="group rounded-lg border border-zinc-200 bg-[#fbfaf7] p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          {icon}
        </span>
        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
          {step}
        </span>
      </div>
      <LibraryTitle library={library} className="mt-5" />
      <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {detail}
      </p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-zinc-700 group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-white">
        Open{' '}
        <LibraryWordmark
          library={library}
          includeTanStack={false}
          colorProduct={false}
        />{' '}
        <ArrowRight size={15} aria-hidden="true" />
      </span>
    </Link>
  )
}

function RelatedPostsBlock({ items }: { items: Array<RelatedPost> }) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="border-t border-zinc-200 bg-[#f7f5ef] dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <SectionKicker icon={<Newspaper size={14} />}>
          From the team
        </SectionKicker>
        <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
          Recent writing from these libraries
        </h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {items.map(({ post, lib }) => (
            <li key={post.slug}>
              <Link
                to="/blog/$"
                params={{ _splat: post.slug }}
                className="group flex h-full flex-col rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={twMerge(
                      'inline-flex rounded-md bg-gradient-to-r px-2 py-1 text-xs font-black text-white',
                      lib.colorFrom,
                      lib.colorTo,
                    )}
                  >
                    <LibraryWordmark
                      library={lib}
                      includeTanStack={false}
                      colorProduct={false}
                    />
                  </span>
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {formatPublishedDate(post.published)}
                  </span>
                </div>
                <p className="mt-3 text-base font-bold leading-snug group-hover:underline">
                  {post.title}
                </p>
                {post.excerpt ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {post.excerpt}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
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
    <p className="inline-flex items-center gap-2 text-sm font-black uppercase text-zinc-600 dark:text-zinc-400">
      {icon}
      {children}
    </p>
  )
}

function LibraryTitle({
  className,
  library,
  overline = 'TanStack',
}: {
  className?: string
  library: LibrarySlim
  overline?: string
}) {
  return (
    <div className={twMerge('min-w-0', className)}>
      <p className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">
        {overline}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-black leading-tight">
          <LibraryWordmark library={library} />
        </h3>
        {library.badge ? (
          <span
            className={twMerge(
              'rounded-md bg-gradient-to-r px-1.5 py-0.5 text-xs font-black uppercase',
              library.colorFrom,
              library.colorTo,
              library.badgeTextStyle ?? 'text-white',
            )}
          >
            {library.badge}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function LibraryButton({
  label,
  library,
  muted = false,
}: {
  label: string
  library: LibrarySlim
  muted?: boolean
}) {
  const productName = shortName(library)
  const actionLabel = label.endsWith(productName)
    ? label.slice(0, -productName.length).trim()
    : label

  return (
    <Link
      to={library.to ?? '#'}
      className={twMerge(
        'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors',
        muted
          ? 'border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500'
          : 'border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200',
      )}
    >
      {actionLabel ? `${actionLabel} ` : null}
      {label.endsWith(productName) ? (
        <LibraryWordmark
          library={library}
          includeTanStack={false}
          colorProduct={false}
        />
      ) : null}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  )
}

function getLibraryById(
  libraries: Array<LibrarySlim>,
  libraryId: LibrarySlim['id'],
) {
  const library = libraries.find((candidate) => candidate.id === libraryId)

  if (library) {
    return library
  }

  const fallback = libraries[0]

  if (!fallback) {
    throw new Error(`No libraries available for category lookup: ${libraryId}`)
  }

  return fallback
}

function shortName(library: LibrarySlim) {
  return library.name.replace('TanStack ', '')
}
