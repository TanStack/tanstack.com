import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowsClockwiseIcon,
  EyeClosedIcon,
  KeyIcon,
  LightningIcon,
  PlusIcon,
  SkullIcon,
} from '@phosphor-icons/react'

import { usePrefersReducedMotion } from '~/utils/usePrefersReducedMotion'
import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

type QueryHeroIssue = {
  id: string
  observers: number
  priority: number
  title: string
}

type QueryHeroSnapshot = {
  fetchedAt: number
  revision: number
  rows: Array<QueryHeroIssue>
}

type QueryHeroMutationContext = {
  previous?: QueryHeroSnapshot
}

const queryHeroKey = ['landing-query-hero'] as const

const queryHeroInitialRows: Array<QueryHeroIssue> = [
  { id: 'router-cache', observers: 3, priority: 98, title: 'Router dashboard' },
  { id: 'project-detail', observers: 2, priority: 91, title: 'Project detail' },
  {
    id: 'offline-queue',
    observers: 1,
    priority: 84,
    title: 'Offline mutation queue',
  },
]

const queryHeroInitialSnapshot: QueryHeroSnapshot = {
  // `0` keeps `Date.now()` out of the first render so SSR and hydration agree.
  fetchedAt: 0,
  revision: 0,
  rows: queryHeroInitialRows,
}

const queryHeroMutationTitles = [
  'Optimistic table edit',
  'Search filter sync',
  'Background retry lane',
  'Prefetched route data',
]

function waitForQueryHero(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

const queryLanding = {
  libraryId: 'query',
  headline: 'The server-state standard for modern frontend apps.',
  description:
    'Query gives async data a cache, a lifecycle, and declarative APIs for fetching, sharing, refetching, mutating, and observing server state.',
  distinction: 'Server and client state are not the same',
  hero: {
    label: 'query client',
    actionLabel: 'Add issue',
    detailTitle: 'useQuery()',
    detailBody:
      'Components declare the data they need. The cache coordinates fetches, subscribers, freshness, retries, and background updates.',
    items: [
      {
        key: "['issues', 'router-cache']",
        title: 'Router dashboard',
        badge: 'P98',
        activity: 92,
      },
      {
        key: "['issues', 'project-detail']",
        title: 'Project detail',
        badge: 'P91',
        activity: 78,
      },
      {
        key: "['issues', 'offline-queue']",
        title: 'Offline mutation queue',
        badge: 'P84',
        activity: 68,
      },
    ],
    facts: [
      { label: 'status', value: 'success' },
      { label: 'isFetching', value: 'false' },
      { label: 'staleTime', value: '3,200' },
      { label: 'mutation', value: 'idle' },
    ],
  },
  features: [
    {
      icon: SkullIcon,
      label: 'Deadly defaults',
      title: 'Deadly defaults kill boring work.',
      body: 'Caching, request deduplication, retries, background refetching, window-focus updates, and garbage collection arrive wired for real applications.',
    },
    {
      icon: KeyIcon,
      label: 'Query keys',
      title: 'Keys become the cache contract.',
      body: 'Model the resource, inputs, filters, and scope once so reads, writes, invalidation, prefetching, and devtools all speak the same language.',
    },
    {
      icon: LightningIcon,
      label: 'State Management',
      title: 'Writes get a real lifecycle.',
      body: 'Pending UI, optimistic updates, rollback, targeted invalidation, and background reconciliation stay explicit instead of scattering through components.',
    },
    {
      icon: EyeClosedIcon,
      label: 'Devtools',
      title: 'See what the cache is doing.',
      body: 'Inspect keys, observers, freshness, retries, errors, mutations, and cache contents while the application is actually running.',
    },
  ],
  lifecycle: {
    label: 'Cache lifecycle',
    title: 'Keep data useful while the network catches up.',
    body: 'Stale data can remain valuable. Render from cache immediately, refresh quietly, and clean up only after the last observer leaves.',
    steps: [
      {
        label: 'Fetch',
        body: 'A query function resolves data while Query owns cancellation, retries, and deduplication.',
      },
      {
        label: 'Share',
        body: 'Every observer reads the same cache entry instead of issuing another request.',
      },
      {
        label: 'Revalidate',
        body: 'Stale data stays visible while a background request refreshes it.',
      },
      {
        label: 'Collect',
        body: 'Unused data remains available briefly, then garbage collection removes it.',
      },
    ],
  },
  flow: {
    label: 'Mutations',
    title: 'Writes update the world, then the cache.',
    body: 'Optimistic UI, pending state, recovery, invalidation, and reconciliation stay explicit instead of scattering through components.',
    steps: [
      { label: 'optimistic write', code: "setQueryData(['todos'], next)" },
      { label: 'server mutation', code: 'await saveTodo(todo)' },
      {
        label: 'targeted refresh',
        code: "invalidateQueries({ queryKey: ['todos'] })",
      },
      { label: 'rollback path', code: 'onError: restoreSnapshot' },
    ],
  },
  prompt:
    'Build a TanStack Query server-state layer for a TypeScript app. Use domain-shaped query keys, colocated query functions, optimistic mutations where useful, and targeted invalidation after writes. Include loading, error, empty, background-refetch, and stale-data states. Keep server data out of global client state.',
  promptLabel: 'Copy Query prompt',
} satisfies LibraryLandingConfig

export default function QueryLanding() {
  return (
    <LibraryLanding
      config={{ ...queryLanding, heroRender: <QueryCachePanel /> }}
    />
  )
}

function QueryCachePanel() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const queryClient = useQueryClient()
  const serverRowsRef = React.useRef(queryHeroInitialRows)
  const serverRevisionRef = React.useRef(0)
  const mutationSequenceRef = React.useRef(0)
  // Starts paused so the server render matches the first client render; the
  // effect below turns it on unless the visitor asked for reduced motion.
  const [isLive, setIsLive] = React.useState(false)
  // `0` until the first tick, for the same first-render reason as `fetchedAt`.
  const [now, setNow] = React.useState(0)

  const projectsQuery = useQuery({
    queryKey: queryHeroKey,
    queryFn: async (): Promise<QueryHeroSnapshot> => {
      await waitForQueryHero(620)

      return {
        fetchedAt: Date.now(),
        revision: serverRevisionRef.current,
        rows: serverRowsRef.current,
      }
    },
    initialData: queryHeroInitialSnapshot,
    initialDataUpdatedAt: 0,
    refetchInterval: isLive ? 4200 : false,
    staleTime: 3200,
  })

  const addIssueMutation = useMutation<
    QueryHeroIssue,
    Error,
    QueryHeroIssue,
    QueryHeroMutationContext
  >({
    mutationFn: async (issue) => {
      await waitForQueryHero(720)
      serverRevisionRef.current += 1
      serverRowsRef.current = [
        issue,
        ...serverRowsRef.current.filter((row) => row.id !== issue.id),
      ].slice(0, 5)

      return issue
    },
    onMutate: async (issue) => {
      await queryClient.cancelQueries({ queryKey: queryHeroKey })
      const previous = queryClient.getQueryData<QueryHeroSnapshot>(queryHeroKey)

      queryClient.setQueryData<QueryHeroSnapshot>(queryHeroKey, (current) => ({
        fetchedAt: current?.fetchedAt ?? 0,
        revision: current?.revision ?? serverRevisionRef.current,
        rows: [
          issue,
          ...(current?.rows ?? queryHeroInitialRows).filter(
            (row) => row.id !== issue.id,
          ),
        ].slice(0, 5),
      }))

      return { previous }
    },
    onError: (_error, _issue, context) => {
      if (context?.previous) {
        queryClient.setQueryData<QueryHeroSnapshot>(
          queryHeroKey,
          context.previous,
        )
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryHeroKey }),
  })

  const cacheState = projectsQuery.isFetching
    ? 'fetching'
    : projectsQuery.isStale
      ? 'stale'
      : 'fresh'
  const fetchedLabel =
    projectsQuery.data.fetchedAt > 0
      ? `${Math.max(0, Math.round((Math.max(now, projectsQuery.data.fetchedAt) - projectsQuery.data.fetchedAt) / 1000))}s ago`
      : 'primed'

  React.useEffect(() => {
    if (prefersReducedMotion === null) return

    setIsLive(prefersReducedMotion === false)
  }, [prefersReducedMotion])

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const addIssue = () => {
    const nextSequence = mutationSequenceRef.current + 1
    const nextTitle =
      queryHeroMutationTitles[
        (nextSequence - 1) % queryHeroMutationTitles.length
      ]

    mutationSequenceRef.current = nextSequence
    addIssueMutation.mutate({
      id: `optimistic-${nextSequence}`,
      observers: (nextSequence % 3) + 1,
      priority: 72 + ((nextSequence * 7) % 24),
      title: nextTitle ?? 'Optimistic write',
    })
  }

  return (
    <div className="library-landing-graphic min-w-0 overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.45)] bg-background-surface shadow-[0_24px_70px_-28px_rgb(var(--landing-glow)/0.45)] dark:shadow-[inset_-3px_-4px_18px_-7px_var(--landing-accent),0_24px_70px_rgb(0_0_0/0.18)]">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/65">
          {queryLanding.hero.label}
        </span>
      </div>

      <div className="grid min-h-[22rem] lg:grid-cols-[1.08fr_0.82fr]">
        <div className="space-y-3 border-border-subtle p-4 lg:border-r">
          <div className="mb-4 flex flex-wrap items-center gap-2 font-ds-mono text-ds-mono-caps-xs uppercase">
            <span
              className={
                cacheState === 'fresh'
                  ? 'rounded-sm bg-emerald-500 px-2 py-1 text-emerald-950'
                  : cacheState === 'fetching'
                    ? 'rounded-sm bg-amber-400 px-2 py-1 text-amber-950'
                    : 'rounded-sm bg-[var(--landing-accent)] px-2 py-1 text-[var(--landing-accent-ink)]'
              }
            >
              {cacheState}
            </span>
            <span className="rounded-sm bg-text-primary/5 px-2 py-1 text-text-primary/35">
              rev {projectsQuery.data.revision} / {fetchedLabel}
            </span>
          </div>

          {projectsQuery.data.rows.map((row) => (
            <div
              key={row.id}
              className="block w-full rounded-lg border border-transparent bg-background-subtle p-4 text-left"
            >
              <span className="flex items-start justify-between gap-4">
                <span className="min-w-0">
                  <span className="block truncate font-ds-mono text-ds-mono-xs text-text-primary">
                    ['issues', '{row.id}']
                  </span>
                  <span className="mt-1 block text-ds-body-xs text-text-primary/45">
                    {row.title}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-[var(--landing-accent)] px-2 py-1 font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-ink)]">
                  P{row.priority}
                </span>
              </span>
              <span className="mt-4 flex items-center gap-3">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-text-primary/5">
                  <span
                    className="block h-full rounded-full bg-[var(--landing-accent)] transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${row.priority}%` }}
                  />
                </span>
                <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/35">
                  {row.observers} obs
                </span>
              </span>
            </div>
          ))}
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-2 text-ds-label-sm text-text-primary/70 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
                onClick={() => projectsQuery.refetch()}
              >
                <ArrowsClockwiseIcon
                  aria-hidden="true"
                  size={13}
                  weight="bold"
                  className={
                    projectsQuery.isFetching
                      ? 'animate-spin motion-reduce:animate-none'
                      : ''
                  }
                />
                Refetch
              </button>
              <button
                type="button"
                disabled={addIssueMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#ff5f5f] px-3 py-2 text-ds-label-sm text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait disabled:opacity-70"
                onClick={addIssue}
              >
                <PlusIcon aria-hidden="true" size={13} weight="bold" />
                {queryLanding.hero.actionLabel}
              </button>
            </div>
          </div>

          <div className="mt-7" aria-live="polite">
            <p className="text-ds-heading-4">{queryLanding.hero.detailTitle}</p>
            <p className="mt-2 truncate font-ds-mono text-ds-mono-xs text-[var(--landing-accent-bright)]">
              ['issues', '{projectsQuery.data.rows[0]?.id ?? 'router-cache'}']
            </p>
            <p className="mt-4 text-ds-body-sm text-text-primary/55">
              {queryLanding.hero.detailBody}
            </p>
          </div>

          <dl className="mt-auto space-y-2 rounded-lg bg-background-subtle p-4 text-ds-body-xs">
            {[
              { label: 'status', value: projectsQuery.status },
              {
                label: 'isFetching',
                value: String(projectsQuery.isFetching),
              },
              { label: 'staleTime', value: '3,200' },
              { label: 'mutation', value: addIssueMutation.status },
            ].map((fact) => (
              <div key={fact.label} className="flex justify-between gap-3">
                <dt className="text-text-primary/45">{fact.label}</dt>
                <dd className="text-right font-ds-mono text-ds-mono-xs text-text-primary/85">
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
