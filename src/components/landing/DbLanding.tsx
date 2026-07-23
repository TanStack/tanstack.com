import * as React from 'react'
import {
  ArrowRight,
  CheckCircle,
  Database,
  Funnel,
  Lightning,
  Network,
  Plugs,
  Stack,
  XCircle,
} from '@phosphor-icons/react'

import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const dbPrompt = [
  'Build a TanStack DB data layer for a TypeScript app.',
  'Model API data as typed collections, query across collections with live queries, and use optimistic mutations with persistence and rollback.',
  'Show how an existing TanStack Query or REST workflow can adopt collections first, then add on-demand query-driven sync when the backend supports it.',
].join(' ')

const projects = [
  { id: 'p1', name: 'Dashboard', team: 'platform' },
  { id: 'p2', name: 'Onboarding', team: 'growth' },
  { id: 'p3', name: 'Billing', team: 'platform' },
] as const

const issues = [
  {
    id: 'ISS-42',
    priority: 'high',
    projectId: 'p1',
    status: 'open',
    title: 'Stream activity feed',
  },
  {
    id: 'ISS-51',
    priority: 'medium',
    projectId: 'p2',
    status: 'open',
    title: 'Shorten invite flow',
  },
  {
    id: 'ISS-58',
    priority: 'high',
    projectId: 'p3',
    status: 'open',
    title: 'Reconcile invoices',
  },
  {
    id: 'ISS-60',
    priority: 'low',
    projectId: 'p1',
    status: 'closed',
    title: 'Archive old events',
  },
] as const

const adoptionPaths = [
  {
    source: 'TanStack Query',
    bridge: 'queryCollectionOptions()',
    detail:
      'Keep the Query client and materialize fetched rows into a collection.',
  },
  {
    source: 'REST or GraphQL',
    bridge: 'collection handlers',
    detail:
      'Load records and persist mutations through the API you already own.',
  },
  {
    source: 'Sync engine',
    bridge: 'collection adapter',
    detail:
      'Use Electric, PowerSync, RxDB, TrailBase, or a custom collection creator.',
  },
] as const

export default function DbLanding() {
  return (
    <LibraryLandingShell
      libraryId="db"
      headline="Take the network off the interaction path."
      description="DB turns API data into typed collections, runs live relational queries over them, and applies optimistic writes immediately while persistence catches up."
      hero={<OptimisticWorkbench />}
      prompt={dbPrompt}
      promptLabel="Copy DB prompt"
    >
      <LandingSection tone="raised">
        <LandingSectionIntro
          centered
          eyebrow="A third path"
          icon={<Database aria-hidden="true" size={15} />}
          title="Stop choosing between endpoint sprawl and loading everything."
          body="Normalized collections keep the backend shape simple. Components can ask a fast local query engine for the exact joined, filtered, and aggregated view they need."
        />
        <DataShapeChoices />
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <LiveQueryLab />
          <LandingSectionIntro
            eyebrow="Live relational queries"
            icon={<Lightning aria-hidden="true" size={15} />}
            title="Describe the view. DB keeps the result current."
            body="Queries can filter, project, join, include, order, group, and aggregate across collections. Differential dataflow updates affected results incrementally as the underlying records change."
          />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="On-demand sync"
            icon={<Funnel aria-hidden="true" size={15} />}
            title="The component query can shape the request."
            body="With on-demand sync, predicates, ordering, limits, and offsets can reach the collection loader. Translate them into API parameters and load only the subset active views require."
          />
          <QueryDrivenSync />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          centered
          eyebrow="Brownfield by design"
          icon={<Plugs aria-hidden="true" size={15} />}
          title="Adopt collections without replacing the backend."
          body="Start from the data source already in production. Components use the same live-query model whether records arrive through TanStack Query, an API, local persistence, or a sync engine."
        />
        <AdoptionPaths />
      </LandingSection>
    </LibraryLandingShell>
  )
}

function OptimisticWorkbench() {
  const [state, setState] = React.useState<
    'idle' | 'persisting' | 'completed' | 'failed'
  >('idle')
  const hasOptimisticChange = state === 'persisting' || state === 'completed'
  const openCount = hasOptimisticChange ? 1 : 2
  const transactionLabel = {
    completed: 'confirmed',
    failed: 'rolled back',
    idle: 'ready',
    persisting: 'optimistic',
  }[state]

  return (
    <LandingWindow label="live todo collection">
      <div className="grid min-h-[23rem] lg:grid-cols-[0.72fr_1.28fr]">
        <div className="border-border-subtle p-4 lg:border-r">
          <div className="space-y-3">
            {[
              ['collection', '3 records'],
              ['live query', openCount + ' open'],
              ['transaction', transactionLabel],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-border-subtle bg-background-subtle p-4"
              >
                <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
                  {label}
                </p>
                <p className="mt-2 font-ds-mono text-ds-mono-xs text-[var(--landing-accent-bright)]">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-[color:rgb(var(--landing-glow)/0.12)] p-4">
            <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
              persist on your cadence
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-ds-body-xs text-text-primary/45">
              <span>debounce</span>
              <span>·</span>
              <span>throttle</span>
              <span>·</span>
              <span>queue</span>
            </div>
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-ds-mono text-ds-mono-2xs text-text-primary/70">
              useLiveQuery(openTodos)
            </p>
            <span
              className={
                state === 'failed'
                  ? 'rounded bg-red-400 px-2 py-1 font-ds-mono text-ds-mono-caps-xs uppercase text-red-950'
                  : 'rounded bg-[var(--landing-accent)] px-2 py-1 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-ink)]'
              }
              aria-live="polite"
            >
              {transactionLabel}
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle">
            <div className="grid grid-cols-[1fr_auto] bg-background-subtle px-3 py-2 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
              <span>open task</span>
              <span>sync state</span>
            </div>
            {!hasOptimisticChange ? (
              <TodoRow
                title="Ship invite flow"
                state={state === 'failed' ? 'restored' : 'synced'}
              />
            ) : null}
            <TodoRow title="Review pricing copy" state="synced" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {state === 'idle' || state === 'failed' || state === 'completed' ? (
              <button
                type="button"
                className="rounded-lg bg-[var(--landing-accent)] px-3 py-2 text-ds-label-sm text-[var(--landing-accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
                onClick={() => setState('persisting')}
              >
                Complete first task
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-ds-label-sm text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  onClick={() => setState('completed')}
                >
                  <CheckCircle aria-hidden="true" size={15} /> Server confirms
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-red-400 px-3 py-2 text-ds-label-sm text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  onClick={() => setState('failed')}
                >
                  <XCircle aria-hidden="true" size={15} /> Server rejects
                </button>
              </>
            )}
            {state !== 'idle' ? (
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-ds-label-sm text-text-primary/35 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
                onClick={() => setState('idle')}
              >
                Reset
              </button>
            ) : null}
          </div>

          <p className="mt-5 text-ds-body-xs text-text-primary/35">
            The live result changes immediately. Persistence either confirms the
            local state or removes it automatically when the handler fails.
          </p>
        </div>
      </div>
    </LandingWindow>
  )
}

function TodoRow({ state, title }: { state: string; title: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-border-subtle bg-background-surface px-3 py-3">
      <span className="truncate text-ds-label-sm text-text-primary/75">
        {title}
      </span>
      <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
        {state}
      </span>
    </div>
  )
}

function DataShapeChoices() {
  const choices = [
    {
      number: '01',
      title: 'Endpoint per screen',
      detail:
        'The backend inherits every view and relationship the product invents.',
      accent: false,
    },
    {
      number: '02',
      title: 'Load everything',
      detail:
        'The browser receives broad payloads and repeatedly recomputes derived views.',
      accent: false,
    },
    {
      number: '03',
      title: 'Collections + live queries',
      detail:
        'Keep normalized records locally and ask for each view as a reactive query.',
      accent: true,
    },
  ] as const

  return (
    <div className="mx-auto mt-14 grid max-w-[72rem] gap-4 lg:grid-cols-3">
      {choices.map((choice) => (
        <div
          key={choice.number}
          className={
            choice.accent
              ? 'rounded-xl border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.18)] p-6 shadow-[0_20px_60px_rgb(var(--landing-glow)/0.12)]'
              : 'rounded-xl border border-border-subtle bg-background-surface p-6'
          }
        >
          <p className="font-ds-display text-ds-display-md text-[var(--landing-accent-bright)]">
            {choice.number}
          </p>
          <h3 className="mt-5 text-ds-heading-4">{choice.title}</h3>
          <p className="mt-4 text-ds-body-xs text-text-primary/35">
            {choice.detail}
          </p>
        </div>
      ))}
    </div>
  )
}

function LiveQueryLab() {
  const [team, setTeam] = React.useState<'all' | 'platform' | 'growth'>('all')
  const joinedRows = issues.flatMap((issue) => {
    const project = projects.find((item) => item.id === issue.projectId)
    if (
      !project ||
      issue.status !== 'open' ||
      (team !== 'all' && project.team !== team)
    ) {
      return []
    }
    return [
      {
        id: issue.id,
        priority: issue.priority,
        project: project.name,
        title: issue.title,
      },
    ]
  })

  const filters = [
    { id: 'all', label: 'All teams' },
    { id: 'platform', label: 'Platform' },
    { id: 'growth', label: 'Growth' },
  ] as const

  return (
    <LandingWindow label="cross-collection live query">
      <div className="p-5">
        <pre className="overflow-x-auto rounded-lg bg-ds-neutral-500 p-4">
          <code className="font-ds-mono text-ds-mono-xs text-white/55">
            <span className="text-[var(--landing-accent-bright)]">from</span>{' '}
            issues
            <br />
            <span className="text-[var(--landing-accent-bright)]">
              join
            </span>{' '}
            projects on projectId
            <br />
            <span className="text-[var(--landing-accent-bright)]">
              where
            </span>{' '}
            status = open
          </code>
        </pre>
        <div
          className="mt-4 flex flex-wrap gap-2"
          role="group"
          aria-label="Team filter"
        >
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={team === filter.id}
              className="rounded-full border border-border-default px-3 py-1.5 text-ds-label-sm text-text-primary/35 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setTeam(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2" aria-live="polite">
          {joinedRows.map((row) => (
            <div
              key={row.id}
              className="grid gap-2 rounded-lg border border-border-subtle bg-background-subtle p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <span className="font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]">
                {row.id}
              </span>
              <span className="min-w-0 truncate text-ds-label-sm text-text-primary/70">
                {row.title}
              </span>
              <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/30">
                {row.project} · {row.priority}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
          {joinedRows.length} result{joinedRows.length === 1 ? '' : 's'} ·
          inferred output
        </p>
      </div>
    </LandingWindow>
  )
}

function QueryDrivenSync() {
  const steps = [
    {
      icon: Funnel,
      label: 'active query',
      code: 'team = platform · limit 20',
    },
    {
      icon: Network,
      label: 'load subset',
      code: 'ctx.meta.loadSubsetOptions',
    },
    {
      icon: Database,
      label: 'API request',
      code: 'GET /issues?team=platform&limit=20',
    },
  ] as const

  return (
    <LandingWindow label="query-driven sync">
      <ol className="p-5 sm:p-6">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <React.Fragment key={step.label}>
              <li className="grid gap-4 rounded-xl border border-border-subtle bg-background-subtle p-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--landing-accent)] text-[var(--landing-accent-ink)]">
                  <Icon aria-hidden="true" size={19} />
                </span>
                <div className="min-w-0">
                  <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
                    {step.label}
                  </p>
                  <p className="mt-2 overflow-x-auto font-ds-mono text-ds-mono-2xs text-text-primary/70">
                    {step.code}
                  </p>
                </div>
              </li>
              {index < steps.length - 1 ? (
                <div
                  aria-hidden="true"
                  className="ml-5 h-5 w-px bg-[var(--landing-accent)]"
                />
              ) : null}
            </React.Fragment>
          )
        })}
      </ol>
    </LandingWindow>
  )
}

function AdoptionPaths() {
  return (
    <div className="mx-auto mt-14 max-w-[72rem] overflow-hidden rounded-xl border border-border-default bg-background-surface">
      {adoptionPaths.map((path, index) => (
        <div
          key={path.source}
          className="grid gap-5 border-b border-border-subtle p-5 last:border-b-0 md:grid-cols-[0.7fr_auto_1fr] md:items-center md:p-7"
        >
          <div className="flex items-center gap-3">
            <Stack
              aria-hidden="true"
              className="text-[var(--landing-accent-bright)]"
              size={20}
            />
            <p className="text-ds-heading-5">{path.source}</p>
          </div>
          <div className="flex items-center gap-3 text-[var(--landing-accent-bright)]">
            <ArrowRight
              aria-hidden="true"
              className="rotate-90 md:rotate-0"
              size={18}
            />
            <span className="rounded-full border border-[var(--landing-accent)] px-3 py-1.5 font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]">
              {path.bridge}
            </span>
          </div>
          <div>
            <p className="text-ds-body-sm text-text-primary/45">
              {path.detail}
            </p>
            {index === adoptionPaths.length - 1 ? (
              <p className="mt-2 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
                same collection · same live query
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
