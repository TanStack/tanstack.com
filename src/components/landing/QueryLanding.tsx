import { EyeClosed, Key, Lightning, Skull } from '@phosphor-icons/react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

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
      icon: Skull,
      label: 'Deadly defaults',
      title: 'Deadly defaults kill boring work.',
      body: 'Caching, request deduplication, retries, background refetching, window-focus updates, and garbage collection arrive wired for real applications.',
    },
    {
      icon: Key,
      label: 'Query keys',
      title: 'Keys become the cache contract.',
      body: 'Model the resource, inputs, filters, and scope once so reads, writes, invalidation, prefetching, and devtools all speak the same language.',
    },
    {
      icon: Lightning,
      label: 'State Management',
      title: 'Writes get a real lifecycle.',
      body: 'Pending UI, optimistic updates, rollback, targeted invalidation, and background reconciliation stay explicit instead of scattering through components.',
    },
    {
      icon: EyeClosed,
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
  return <LibraryLanding config={queryLanding} />
}
