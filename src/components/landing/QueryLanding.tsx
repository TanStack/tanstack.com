import * as React from 'react'
import {
  useIsFetching,
  useMutation,
  useQueries,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ArrowsClockwiseIcon,
  EyeClosedIcon,
  KeyIcon,
  LightningIcon,
  PlusIcon,
  SkullIcon,
} from '@phosphor-icons/react'

import { useToast } from '~/components/ToastProvider'
import { usePrefersReducedMotion } from '~/utils/usePrefersReducedMotion'
import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

type QueryHeroIssue = {
  priority: number
  revision: number
  title: string
}

type QueryHeroMutationContext = {
  optimistic?: QueryHeroIssue
  previous?: QueryHeroIssue
}

// Each row is its own cache entry with its own `staleTime`, so the three
// gauges drain at different rates and go stale independently.
const queryHeroRows = [
  {
    id: 'router-cache',
    staleTime: 2000,
    refetchInterval: 3000,
    seed: { priority: 0, revision: 0, title: 'Router dashboard' },
  },
  {
    id: 'project-detail',
    staleTime: 6000,
    refetchInterval: 7000,
    seed: { priority: 0, revision: 0, title: 'Project detail' },
  },
  {
    id: 'offline-queue',
    staleTime: 14000,
    refetchInterval: 15000,
    seed: { priority: 0, revision: 0, title: 'Offline mutation queue' },
  },
] satisfies ReadonlyArray<{
  id: string
  refetchInterval: number
  seed: QueryHeroIssue
  staleTime: number
}>

const queryHeroKey = (id: string) => ['issues', id] as const

type QueryHeroState = 'fetching' | 'fresh' | 'stale'

const queryHeroStateClass: Record<QueryHeroState, string> = {
  fetching: 'bg-amber-400 text-amber-950',
  fresh: 'bg-emerald-500 text-emerald-950',
  stale: 'bg-[var(--landing-accent)] text-[var(--landing-accent-ink)]',
}

function queryHeroState(query: {
  isFetching: boolean
  isStale: boolean
}): QueryHeroState {
  if (query.isFetching) return 'fetching'
  return query.isStale ? 'stale' : 'fresh'
}

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
  const { notify } = useToast()
  // One server-side record per key, so the three queries return distinct data.
  const serverRowsRef = React.useRef<Record<string, QueryHeroIssue>>(
    Object.fromEntries(queryHeroRows.map((row) => [row.id, { ...row.seed }])),
  )
  const bumpAttemptRef = React.useRef(0)
  // Starts paused so the server render matches the first client render; the
  // effect below turns it on unless the visitor asked for reduced motion.
  const [isLive, setIsLive] = React.useState(false)
  // `0` until the first tick; re-renders drive the draining freshness gauges.
  const [now, setNow] = React.useState(0)
  const [selectedId, setSelectedId] = React.useState<string>(
    queryHeroRows[0].id,
  )

  const rowQueries = useQueries({
    queries: queryHeroRows.map((row) => ({
      queryKey: queryHeroKey(row.id),
      queryFn: async (): Promise<QueryHeroIssue> => {
        await waitForQueryHero(620)
        return serverRowsRef.current[row.id]!
      },
      initialData: row.seed,
      initialDataUpdatedAt: 0,
      refetchInterval: isLive ? row.refetchInterval : false,
      staleTime: row.staleTime,
    })),
  })

  // Query tracks in-flight fetches across the whole client, so the header does
  // not have to tally the rows itself.
  const fetchingCount = useIsFetching({ queryKey: ['issues'] })

  const bumpMutation = useMutation<
    QueryHeroIssue,
    Error,
    string,
    QueryHeroMutationContext
  >({
    mutationFn: async (id) => {
      await waitForQueryHero(720)
      // Every third write fails on purpose, so the optimistic update visibly
      // rolls back instead of the rollback path being unreachable code.
      bumpAttemptRef.current += 1
      if (bumpAttemptRef.current % 3 === 0) {
        throw new Error('Write rejected by the server')
      }

      const current = serverRowsRef.current[id]!
      const next = {
        ...current,
        // Wraps instead of clamping so repeated bumps always visibly move.
        priority: current.priority >= 99 ? 0 : current.priority + 1,
        revision: current.revision + 1,
      }
      serverRowsRef.current[id] = next

      return next
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryHeroKey(id) })
      const previous = queryClient.getQueryData<QueryHeroIssue>(
        queryHeroKey(id),
      )

      const optimistic = previous
        ? {
            ...previous,
            // Wraps instead of clamping so repeated bumps always visibly move.
            priority: previous.priority >= 99 ? 0 : previous.priority + 1,
            revision: previous.revision + 1,
          }
        : undefined

      if (optimistic) {
        queryClient.setQueryData<QueryHeroIssue>(queryHeroKey(id), optimistic)
      }

      return { optimistic, previous }
    },
    onError: (_error, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData<QueryHeroIssue>(
          queryHeroKey(id),
          context.previous,
        )
      }
      // A fixed id keeps repeated failures from stacking up toasts.
      notify(
        context?.previous && context.optimistic
          ? `Demo: every third write fails. Rolled ['issues', '${id}'] back from P${context.optimistic.priority} to P${context.previous.priority}.`
          : `Demo: every third write fails. Rolled ['issues', '${id}'] back.`,
        { id: 'query-landing-rollback' },
      )
    },
    // Only the mutated key is invalidated; the other rows keep their own
    // freshness windows.
    onSettled: (_data, _error, id) =>
      queryClient.invalidateQueries({ queryKey: queryHeroKey(id) }),
  })

  const rows = queryHeroRows.map((row, index) => {
    const query = rowQueries[index]!
    const elapsed = query.dataUpdatedAt > 0 ? now - query.dataUpdatedAt : 0
    return {
      ...row,
      query,
      issue: query.data,
      state: queryHeroState(query),
      // Read from the cache rather than seeded, so it reflects the components
      // actually subscribed to this key.
      observers:
        queryClient
          .getQueryCache()
          .find({ queryKey: queryHeroKey(row.id) })
          ?.getObserversCount() ?? 0,
      // Drains from 100% to 0% across this row's own `staleTime`.
      freshness:
        query.dataUpdatedAt > 0
          ? Math.max(
              0,
              Math.min(100, Math.round((1 - elapsed / row.staleTime) * 100)),
            )
          : 100,
    }
  })
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0]!
  // The header summarises all three entries; each row carries its own badge.
  const freshCount = rows.filter((row) => row.state === 'fresh').length
  const cacheState =
    fetchingCount > 0 ? 'fetching' : freshCount > 0 ? 'fresh' : 'stale'
  const fetchedLabel =
    selected.query.dataUpdatedAt > 0
      ? `${Math.max(0, Math.round((Math.max(now, selected.query.dataUpdatedAt) - selected.query.dataUpdatedAt) / 1000))}s ago`
      : 'primed'

  React.useEffect(() => {
    if (prefersReducedMotion === null) return

    setIsLive(prefersReducedMotion === false)
  }, [prefersReducedMotion])

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

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
              className={`rounded-sm px-2 py-1 ${queryHeroStateClass[cacheState]}`}
            >
              {cacheState}
            </span>
            <span className="rounded-sm bg-text-primary/5 px-2 py-1 text-text-primary/35">
              {freshCount}/{rows.length} fresh
            </span>
          </div>

          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              aria-pressed={row.id === selected.id}
              className="block w-full rounded-lg border border-transparent bg-background-subtle p-4 text-left transition-colors hover:border-text-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[color:rgb(var(--landing-glow)/0.42)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.1)]"
              onClick={() => setSelectedId(row.id)}
            >
              <span className="flex items-start justify-between gap-4">
                <span className="min-w-0">
                  <span className="block truncate font-ds-mono text-ds-mono-xs text-text-primary">
                    ['issues', '{row.id}']
                  </span>
                  <span className="mt-1 block text-ds-body-xs text-text-primary/45">
                    {row.issue.title}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`rounded px-2 py-1 font-ds-mono text-ds-mono-2xs uppercase ${queryHeroStateClass[row.state]}`}
                  >
                    {row.state}
                  </span>
                  <span className="rounded bg-[var(--landing-accent)] px-2 py-1 font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-ink)]">
                    P{row.issue.priority}
                  </span>
                </span>
              </span>
              <span className="mt-4 flex items-center gap-3">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-text-primary/5">
                  <span
                    className="block h-full rounded-full bg-[var(--landing-accent)] transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${row.freshness}%` }}
                  />
                </span>
                <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/35">
                  {row.staleTime / 1000}s stale
                </span>
              </span>
            </button>
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
                onClick={() => selected.query.refetch()}
              >
                <ArrowsClockwiseIcon
                  aria-hidden="true"
                  size={13}
                  weight="bold"
                  className={
                    selected.query.isFetching
                      ? 'animate-spin motion-reduce:animate-none'
                      : ''
                  }
                />
                Refetch
              </button>
              <button
                type="button"
                disabled={bumpMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#ff5f5f] px-3 py-2 text-ds-label-sm text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait disabled:opacity-70"
                onClick={() => bumpMutation.mutate(selected.id)}
              >
                <PlusIcon aria-hidden="true" size={13} weight="bold" />
                Bump priority
              </button>
            </div>
          </div>

          <div className="mt-7" aria-live="polite">
            <p className="text-ds-heading-4">{queryLanding.hero.detailTitle}</p>
            <p className="mt-2 truncate font-ds-mono text-ds-mono-xs text-[var(--landing-accent-bright)]">
              ['issues', '{selected.id}']
            </p>
            <p className="mt-4 text-ds-body-sm text-text-primary/55">
              {queryLanding.hero.detailBody}
            </p>
          </div>

          <dl className="mt-auto space-y-2 rounded-lg bg-background-subtle p-4 text-ds-body-xs">
            {[
              { label: 'status', value: selected.query.status },
              { label: 'fetchStatus', value: selected.query.fetchStatus },
              {
                label: 'isStale',
                value: String(selected.query.isStale),
              },
              {
                label: 'observers',
                value: String(selected.observers),
              },
              {
                label: 'staleTime',
                value: selected.staleTime.toLocaleString('en-US'),
              },
              { label: 'updated', value: fetchedLabel },
              { label: 'mutation', value: bumpMutation.status },
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
