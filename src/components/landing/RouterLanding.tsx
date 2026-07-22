import * as React from 'react'
import {
  ArrowRight,
  BracketsCurly,
  CheckCircle,
  CursorClick,
  Link as LinkIcon,
  MagnifyingGlass,
  Path,
  TreeStructure,
} from '@phosphor-icons/react'

import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const routerPrompt = [
  'Build a TanStack Router application with a generated route tree, typed params and search schemas, route loaders, intent preloading, pending and error boundaries, and automatic code splitting.',
  'Keep shareable UI state in the URL and make every link and navigation call type-safe.',
].join(' ')

const routeSpecs = [
  {
    file: 'routes/_app.invoices.$invoiceId.tsx',
    path: '/invoices/$invoiceId',
    param: 'invoiceId',
    search: 'tab: "activity" | "details"',
    loader: 'invoiceQuery(params.invoiceId)',
  },
  {
    file: 'routes/_app.projects.$projectId.tsx',
    path: '/projects/$projectId',
    param: 'projectId',
    search: 'view: "board" | "list"',
    loader: 'projectQuery(params.projectId)',
  },
  {
    file: 'routes/_app.users.$userId.tsx',
    path: '/users/$userId',
    param: 'userId',
    search: 'panel?: "profile" | "access"',
    loader: 'userQuery(params.userId)',
  },
] as const

const searchPresets = [
  { label: 'Popular', page: 2, q: 'router', sort: 'stars' },
  { label: 'Recent', page: 1, q: 'loader', sort: 'recent' },
  { label: 'Guides', page: 3, q: 'search params', sort: 'stars' },
] as const

const contractNodes = [
  {
    icon: LinkIcon,
    label: 'Link',
    code: 'to + params + search',
    detail: 'Navigation autocompletes against the route tree.',
  },
  {
    icon: Path,
    label: 'Match',
    code: 'beforeLoad({ params })',
    detail: 'Path, search, and inherited context narrow together.',
  },
  {
    icon: BracketsCurly,
    label: 'Load',
    code: 'loader({ deps })',
    detail: 'Typed dependencies start before the component renders.',
  },
  {
    icon: CheckCircle,
    label: 'Render',
    code: 'Route.useLoaderData()',
    detail: 'The component receives the exact loader result.',
  },
] as const

export default function RouterLanding() {
  return (
    <LibraryLandingShell
      libraryId="router"
      headline="The route tree is the application contract."
      description="Define routes once, then let TypeScript carry paths, params, search state, loaders, links, and boundaries through every navigation."
      hero={<RouteContractHero />}
      prompt={routerPrompt}
      promptLabel="Copy Router prompt"
    >
      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <SearchStateLab />
          <LandingSectionIntro
            eyebrow="URL state"
            icon={<MagnifyingGlass aria-hidden="true" size={15} />}
            title="The URL is a state manager, not a string bucket."
            body="Search params are parsed, validated, inherited, and typed. Filters, pagination, and tabs survive refreshes, back navigation, bookmarks, and shared links without hand-written serialization."
          />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid items-center gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Preloading"
            icon={<CursorClick aria-hidden="true" size={15} />}
            title="Navigation can begin before the click."
            body="Intent, viewport, and render strategies can preload route code and data. By the time navigation commits, the next screen can already be waiting."
          />
          <PreloadTrace />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          centered
          eyebrow="One contract"
          icon={<TreeStructure aria-hidden="true" size={15} />}
          title="Types survive the whole trip."
          body="The destination, matched route, loader dependencies, and rendered data all derive from the same route definition. Refactors fail in the editor instead of after deployment."
        />
        <ContractMap />
      </LandingSection>

      <LandingSection tone="ink">
        <LandingSectionIntro
          centered
          eyebrow="Choose the boundary"
          title="Use Router for the app. Add Start when the app needs a server."
          body="Router is the complete client-first application model. Start preserves that route tree and adds full-document rendering, server functions, server routes, middleware, and deployable server output."
        />
        <div className="mx-auto mt-12 grid max-w-[62rem] gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-2">
          <div className="bg-[#101010] p-7 md:p-9">
            <p className="font-ds-mono text-ds-mono-caps uppercase text-[var(--landing-accent-bright)]">
              TanStack Router
            </p>
            <h3 className="mt-5 text-ds-heading-3">
              Client-first application routing
            </h3>
            <p className="mt-4 text-ds-body-sm text-white/45">
              Typed navigation, URL state, route loaders, preloading, caching,
              code splitting, and route-owned boundaries.
            </p>
          </div>
          <div className="bg-[#101010] p-7 md:p-9">
            <p className="font-ds-mono text-ds-mono-caps uppercase text-cyan-300">
              TanStack Start
            </p>
            <h3 className="mt-5 text-ds-heading-3">
              The same routes, with a server
            </h3>
            <p className="mt-4 text-ds-body-sm text-white/45">
              Keep Router's app model, then add SSR, streaming, typed server
              work, middleware, and hosting output.
            </p>
          </div>
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function RouteContractHero() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [usesRefactoredParam, setUsesRefactoredParam] = React.useState(false)
  const activeRoute = routeSpecs[activeIndex] ?? routeSpecs[0]
  const param = usesRefactoredParam ? 'recordId' : activeRoute.param
  const file = activeRoute.file.replace(activeRoute.param, param)
  const path = activeRoute.path.replace(activeRoute.param, param)
  const loader = activeRoute.loader.replaceAll(activeRoute.param, param)

  return (
    <LandingWindow label="generated route contract">
      <div className="grid min-h-[23rem] lg:grid-cols-[0.92fr_1.08fr]">
        <div className="border-white/5 p-4 lg:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="font-ds-mono text-[10px] uppercase tracking-[0.16em] text-white/30">
              route files
            </span>
            <span className="rounded bg-emerald-400 px-2 py-1 font-ds-mono text-[9px] font-semibold uppercase text-emerald-950">
              generated
            </span>
          </div>
          <div className="space-y-2">
            {routeSpecs.map((route, index) => (
              <button
                key={route.file}
                type="button"
                aria-pressed={index === activeIndex}
                className="block w-full rounded-lg border border-transparent bg-[#151515] px-3 py-3 text-left transition-colors hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[color:rgb(var(--landing-glow)/0.55)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.12)]"
                onClick={() => {
                  setActiveIndex(index)
                  setUsesRefactoredParam(false)
                }}
              >
                <span className="block truncate font-ds-mono text-[12px] font-medium text-white">
                  {route.file}
                </span>
                <span className="mt-1 block text-ds-body-xs text-white/30">
                  {route.search}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={usesRefactoredParam}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--landing-accent)] px-3 py-2 text-ds-label-sm text-[var(--landing-accent-bright)] transition-colors hover:bg-[color:rgb(var(--landing-glow)/0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
            onClick={() => setUsesRefactoredParam((current) => !current)}
          >
            <BracketsCurly aria-hidden="true" size={16} />
            {usesRefactoredParam ? 'Restore param name' : 'Refactor param name'}
          </button>
        </div>

        <div className="min-w-0 p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-ds-mono text-[11px] font-medium text-[var(--landing-accent-bright)]">
              routeTree.gen.ts
            </p>
            <span className="inline-flex items-center gap-1.5 text-ds-body-xs text-white/35">
              <CheckCircle
                aria-hidden="true"
                className="text-emerald-400"
                size={15}
              />
              contract updated
            </span>
          </div>
          <div className="mt-4 rounded-lg bg-black p-4 font-ds-mono text-[11px] leading-6 text-white/70">
            <p className="break-all text-white/35">{file}</p>
            <p className="mt-2">
              <span className="text-[var(--landing-accent-bright)]">path</span>:
              '{path}'
            </p>
            <p>
              <span className="text-[var(--landing-accent-bright)]">
                params
              </span>
              : {'{'} {param}: string {'}'}
            </p>
            <p>
              <span className="text-[var(--landing-accent-bright)]">
                search
              </span>
              : {'{'} {activeRoute.search} {'}'}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            <CodeRow
              label="link"
              value={'<Link to="' + path + '" params={{ ' + param + ' }} />'}
            />
            <CodeRow label="loader" value={loader} />
            <CodeRow label="read" value={'Route.useParams().' + param} />
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#141414] px-3 py-2.5">
      <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
        {label}
      </p>
      <p className="mt-1 overflow-x-auto font-ds-mono text-[11px] text-white/75">
        {value}
      </p>
    </div>
  )
}

function SearchStateLab() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const active = searchPresets[activeIndex] ?? searchPresets[0]
  const params = new URLSearchParams({
    page: String(active.page),
    q: active.q,
    sort: active.sort,
  })

  return (
    <LandingWindow label="validated search state">
      <div className="p-5 sm:p-6">
        <p className="break-all font-ds-mono text-[12px] text-white/70">
          /docs?
          <span className="text-[var(--landing-accent-bright)]">
            {params.toString()}
          </span>
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {searchPresets.map((preset, index) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={index === activeIndex}
              className="rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-left text-ds-label-sm text-white/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setActiveIndex(index)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <dl
          className="mt-5 grid gap-px overflow-hidden rounded-lg bg-white/5 sm:grid-cols-3"
          aria-live="polite"
        >
          {[
            ['q', active.q],
            ['page', String(active.page)],
            ['sort', active.sort],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#111] p-4">
              <dt className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
                {label}
              </dt>
              <dd className="mt-2 truncate font-ds-mono text-[12px] text-white/80">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 rounded-lg border-l-2 border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.1)] p-4 text-ds-body-xs text-white/45">
          Typed state is now bookmarkable, shareable, and safe to consume in
          loaders and components.
        </div>
      </div>
    </LandingWindow>
  )
}

function PreloadTrace() {
  const [stage, setStage] = React.useState(0)
  const stages = [
    ['match', 'Route and dependencies known'],
    ['preload', 'Code and loader start'],
    ['navigate', 'Fresh result promoted'],
  ] as const

  return (
    <LandingWindow label="intent trace">
      <div className="p-5 sm:p-6">
        <button
          type="button"
          className="group flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.12)] px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
          onPointerEnter={() => setStage((current) => Math.max(current, 1))}
          onFocus={() => setStage((current) => Math.max(current, 1))}
          onClick={() => setStage(2)}
        >
          <span>
            <span className="block text-ds-label-lg text-white">
              Open project activity
            </span>
            <span className="mt-1 block text-ds-body-xs text-white/35">
              Hover or focus to preload. Click to navigate.
            </span>
          </span>
          <ArrowRight
            aria-hidden="true"
            className="shrink-0 text-[var(--landing-accent-bright)] transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
            size={22}
          />
        </button>

        <ol className="mt-7 grid gap-3 sm:grid-cols-3" aria-live="polite">
          {stages.map(([label, detail], index) => {
            const isActive = stage >= index
            return (
              <li
                key={label}
                className={
                  isActive
                    ? 'rounded-lg border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.12)] p-4'
                    : 'rounded-lg border border-white/5 bg-[#121212] p-4'
                }
              >
                <span className="font-ds-display text-ds-heading-2 font-light text-[var(--landing-accent-bright)]">
                  {index + 1}
                </span>
                <p className="mt-3 text-ds-label-md capitalize text-white">
                  {label}
                </p>
                <p className="mt-2 text-ds-body-xs text-white/35">{detail}</p>
              </li>
            )
          })}
        </ol>
        <button
          type="button"
          className="mt-5 font-ds-mono text-[10px] uppercase tracking-[0.14em] text-white/35 underline decoration-white/20 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
          onClick={() => setStage(0)}
        >
          Reset trace
        </button>
      </div>
    </LandingWindow>
  )
}

function ContractMap() {
  return (
    <div className="relative mx-auto mt-14 max-w-[72rem]">
      <div
        aria-hidden="true"
        className="absolute top-10 right-[12%] left-[12%] hidden h-px bg-[color:rgb(var(--landing-glow)/0.55)] md:block"
      />
      <ol className="relative grid gap-4 md:grid-cols-4">
        {contractNodes.map((node, index) => {
          const Icon = node.icon
          return (
            <li
              key={node.label}
              className="rounded-xl border border-white/10 bg-[#111] p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-[var(--landing-accent)] text-[var(--landing-accent-ink)]">
                  <Icon aria-hidden="true" size={19} />
                </span>
                <span className="font-ds-mono text-[10px] text-white/20">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-6 text-ds-heading-4">{node.label}</h3>
              <p className="mt-3 break-words font-ds-mono text-[11px] text-[var(--landing-accent-bright)]">
                {node.code}
              </p>
              <p className="mt-4 text-ds-body-xs text-white/35">
                {node.detail}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
