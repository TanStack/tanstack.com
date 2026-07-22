import {
  ArrowsCounterClockwise,
  Lightning,
  Plugs,
  Stack,
} from '@phosphor-icons/react'

import {
  LibraryLanding,
  type LibraryLandingConfig,
} from '~/components/landing/LibraryLanding'

const dbLandingConfig = {
  libraryId: 'db',
  headline: 'Query your API data like local reactive state.',
  description:
    'DB turns synced API data into typed collections, then runs live queries over them so joins, filters, optimistic writes, and derived UI stay fast and consistent without hand-built client state.',
  distinction: 'A reactive data graph for the client',
  hero: {
    label: 'live query',
    actionLabel: 'Insert',
    detailTitle: 'The result updates, not the whole app',
    detailBody:
      'Typed collections and differential dataflow keep joins, filters, aggregates, and optimistic writes reactive.',
    items: [
      {
        key: 'todo-1',
        title: 'Ship invite flow',
        badge: 'open',
        activity: 88,
      },
      {
        key: 'todo-2',
        title: 'Review pricing copy',
        badge: 'open',
        activity: 72,
      },
      {
        key: 'todo-3',
        title: 'Wire product analytics',
        badge: 'done',
        activity: 100,
      },
    ],
    facts: [
      { label: 'collection', value: 'todos' },
      { label: 'query', value: 'status = open' },
      { label: 'sync', value: 'incremental' },
      { label: 'transaction', value: 'optimistic' },
    ],
  },
  features: [
    {
      icon: Stack,
      label: 'Collections',
      title: 'Collections make API data queryable.',
      body: 'Load, sync, or persist typed records into collections, then query the data your UI actually needs instead of spreading derived state through components.',
    },
    {
      icon: Lightning,
      label: 'Live queries',
      title: 'Live queries update the result, not the whole app.',
      body: 'DB uses differential dataflow to recompute only the changed parts of joins, filters, and aggregates, so large local graphs still feel instant.',
    },
    {
      icon: ArrowsCounterClockwise,
      label: 'Local writes',
      title: 'Local writes are first-class.',
      body: 'Optimistic mutations can stage transactions across collections, update the UI immediately, then commit or rollback with lifecycle support.',
    },
    {
      icon: Plugs,
      label: 'Sync',
      title: 'Sync strategy can evolve with the product.',
      body: 'Start with REST, GraphQL, tRPC, TanStack Query, Electric, PowerSync, Trailbase, or your own collection creator without changing how components query.',
    },
  ],
  lifecycle: {
    label: 'Differential dataflow',
    title: 'The view is a query over collections.',
    body: 'DB keeps normalized collections in memory, then updates live query results incrementally as records change. The UI describes the data shape; DB keeps it current.',
    steps: [
      {
        label: 'Collect',
        body: 'API records enter typed collections from sync engines, query functions, persistence, or custom loaders.',
      },
      {
        label: 'Query',
        body: 'The UI declares filters, joins, includes, aggregates, ordering, and limits.',
      },
      {
        label: 'Increment',
        body: 'DB updates only affected query results instead of recomputing the full graph.',
      },
      {
        label: 'Render',
        body: 'Framework adapters subscribe components without manual cache wiring.',
      },
    ],
  },
  flow: {
    label: 'Query-driven sync',
    title: 'Let the component query become the loading contract.',
    body: 'DB can pass predicates, ordering, and limits to your loader. Map that shape to an API precisely, or start broad and filter locally while the API catches up.',
    steps: [
      { label: 'Predicate', code: 'projectId = params.id' },
      { label: 'Subset', code: 'load visible records' },
      { label: 'Dedupe', code: 'merge requirements' },
      { label: 'Fallback', code: 'fetch broad → filter local' },
    ],
  },
  prompt: [
    'Build a TanStack DB data layer for a TypeScript app.',
    'Model API data as typed collections, query across collections with live queries, use optimistic mutations for local writes, and keep derived UI reactive through the DB query engine.',
    'Show how TanStack DB can start with an existing API or TanStack Query workflow, then add query-driven sync, incremental joins, and optional persistence when the product needs it.',
  ].join(' '),
  promptLabel: 'Copy DB prompt',
} satisfies LibraryLandingConfig

export default function DbLanding() {
  return <LibraryLanding config={dbLandingConfig} />
}
