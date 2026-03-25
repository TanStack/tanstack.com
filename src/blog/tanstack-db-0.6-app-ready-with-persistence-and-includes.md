---
title: TanStack DB 0.6 Now Includes Persistence, Offline Support, and Hierarchical Data
excerpt: TanStack DB 0.6 adds SQLite-backed persistence across runtimes, hierarchical includes for projecting normalized data into UI-shaped trees, reactive effects, virtual props for sync state, and more.
published: 2026-03-25
draft: true
authors:
  - Sam Willis
  - Kevin De Porre
---

![Persistence, Offline Support, and Hierarchical Data](/blog-assets/tanstack-db-0.6-app-ready-with-persistence-and-includes/header.jpg)

With v0.6 of TanStack DB, we're bringing some highly anticipated features and improving the ergonomics for app development.

You can now project normalized data into the same hierarchical shape as your UI, persist local state across runtimes with a SQLite-backed layer, and trigger reactive side effects directly from live queries. Row metadata unlocks outbox views and delivery indicators (think WhatsApp-style), and APIs that previously relied on implicit behavior are now explicit and consistent.

Here’s what shipped:

- [Persistent local state](#persistent-local-state) via SQLite-backed adapters across browser, React Native, Expo, Node, Electron, Capacitor, Tauri, and Cloudflare Durable Objects
- [Includes](#includes-project-your-data-into-the-same-shape-as-your-ui) for projecting normalized data into the hierarchical structure of your UI. Similar to GraphQL, but without the need for new infrastructure.
- [`createEffect`](#createeffect-reactive-side-effects-for-workflows-tools-and-agents) for reactive workflows, side effects, and agent-style automation
- [Virtual props](#virtual-props-outboxes-delivery-state-and-row-provenance) (`$synced`, `$origin`) for outbox views, sync indicators, and provenance-aware queries
- [`queryOnce`](#queryonce) for one-shot queries using the same language as live queries
- Indexes are now opt-in, and mutation handlers no longer rely on implicit return behavior (see [migration notes](#migration-notes))

If you have been watching TanStack DB and waiting for it to feel like a more complete application data layer, this release moves it in that direction.

If you're upgrading an existing app, jump straight to the [migration notes](#migration-notes).

We are also putting out [a call for server-side rendering (SSR) design partners](#toward-v1-help-us-get-ssr-right) as we work toward v1.

Finally, [PowerSync](https://www.powersync.com/) and [Trailbase](https://trailbase.io/) now support incremental sync with TanStack DB. This builds on the incremental sync model introduced for Query Collections and ElectricSQL in [TanStack DB 0.5: Query-Driven Sync](/blog/tanstack-db-0.5-query-driven-sync), extending it to additional backends.

## Shopping List Demo App

One of the best examples of what 0.6 unlocks is our React Native shopping list demo.

<iframe
  width="100%"
  style="aspect-ratio: 16/9;"
  src="https://www.youtube.com/embed/EBXOjQds8hU"
  title="TanStack DB 0.6 Shopping List Demo"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen
></iframe>

It starts with persisted SQLite state via `op-sqlite`, projects normalized data into a hierarchical UI shape with [includes](#includes-project-your-data-into-the-same-shape-as-your-ui), and retains TanStack DB’s fine-grained reactivity underneath. The key shift is what that persistence enables when paired with [`@tanstack/offline-transactions`](https://github.com/TanStack/db/tree/main/packages/offline-transactions).

TanStack DB already had the query engine, transaction model, optimistic updates, and the offline transaction API. Persistence was the missing piece. Once local state is durable, that stack can add up to something fully local-first instead of only feeling local while the app is open.

### More than local-first

Persistence is the most requested feature, but it does not define TanStack DB. The core idea is simpler: put a real transactional query engine on the client, and let storage and synchronization live wherever they belong. Local-first is one configuration of that. Server-authoritative with fast optimistic updates is another. Both are supported by the same primitives.

## Persistent local state

Persistence is the biggest practical unlock in 0.6.

We’ve wanted a persistence layer for a while, and many of you have asked for it. The problem space was always broader than just "save some rows to disk":

- not just faster startup
- must compose with synced remote state and optimistic local state
- must work across runtimes
- must handle large datasets without assuming everything lives in memory
- must support multiple tabs and windows
- must have a sane approach to schema evolution

That led to a pragmatic choice: **use SQLite as the persistence layer**.

This gives TanStack DB a single persistence model that spans:

- browser (via SQLite WASM)
- React Native and Expo
- Node
- Electron
- Tauri
- Capacitor
- Cloudflare Durable Objects

Instead of building separate storage layers per environment, TanStack DB keeps one model with runtime-specific adapters. The result is optional persistent local state that enables local-first applications without constraining other architectures.

For synced collections, persistence does **not** change the source of truth. The server remains authoritative. Persistence provides a durable local base for fast startup, offline work, and reconciliation back to the upstream source of truth when sync resumes.

In practice, the React Native setup looks like this:

```typescript
import { open } from '@op-engineering/op-sqlite'
import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import {
  createReactNativeSQLitePersistence,
  persistedCollectionOptions,
} from '@tanstack/db-react-native-sqlite-persisted-collection'

type ShoppingItem = {
  id: string
  title: string
  completed: boolean
}

const database = open({
  name: `tanstack-db.sqlite`,
  location: `default`,
})

const persistence = createReactNativeSQLitePersistence({
  database,
})

export const shoppingItemsCollection = createCollection(
  persistedCollectionOptions<ShoppingItem, string>({
    persistence,
    schemaVersion: 1,
    ...queryCollectionOptions({
      queryKey: ['shopping-items'],
      queryFn: async () => api.shoppingItems.getAll(),
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        await api.shoppingItems.createBatch(transaction.mutations)
      },
    }),
  }),
)
```

That gives you a durable local base for a synced collection. Paired with `@tanstack/offline-transactions`, it also enables durable writes for a local-first flow.

You can also use `persistedCollectionOptions(...)` without wrapping another synced collection config at all. In that mode, it is simply local state persisted to SQLite:

```typescript
const localDraftsCollection = createCollection(
  persistedCollectionOptions<Draft, string>({
    id: `drafts`,
    getKey: (draft) => draft.id,
    persistence,
    schemaVersion: 1,
  }),
)
```

`schemaVersion` is the switch that keeps these modes honest. For synced collections, changing it clears the persisted local copy and triggers a re-sync from the server. For unsynced local-only collections, changing it throws and requires the application to handle migration explicitly.

This same persistence story also extends beyond UI runtimes. As shown later in [createEffect](#createeffect-reactive-side-effects-for-workflows-tools-and-agents), a persistent TanStack DB running in environments like Cloudflare Durable Objects starts to resemble a state engine for workflows and agents.

### Why SQLite

Using SQLite in the browser is a pragmatic choice for both users and the project.

We considered a split design where the browser used IndexedDB directly to avoid the SQLite WASM download. That path introduced tradeoffs: a more awkward indexing model, more complex connection management, and a divergent query architecture where the browser behaved differently from other runtimes. One sharp edge was that adding indexes required disconnecting all active connections, which does not fit well with TanStack DB’s dynamic usage.

Standardizing on a single persistence engine keeps the model consistent and allows it to extend across mobile, desktop, server, edge, and agent-style runtimes without introducing per-environment complexity.

We also evaluated the cost of the WASM bundle. In practice, for apps already syncing data to the client, the additional cost is relatively small. The tradeoff favors a more consistent persistence and query model over minimizing initial payload size.

### Why this matters

In practice, 0.6 gives you:

- faster restarts
- durable local state, including synced data and pending mutations
- more practical offline-first UX
- a consistent DB mental model across mobile, browser, desktop, server, edge, and agent runtimes

This is the first _alpha_ release of persistence, and so we want to hear your feedback.

## Includes: project your data into the same shape as your UI

All UIs are hierarchical.

Most data systems force a tradeoff: flat relational queries that require manual reshaping, or nested loading patterns that introduce N+1 queries and duplicated work.

GraphQL tackles a similar problem from the server side: give the UI a hierarchical shape without forcing every client to manually stitch flat records back together.

`includes` brings that same idea to the client. It lets you retrieve normalized data and project it directly into the hierarchical structure your UI renders—across any TanStack DB data source, without requiring GraphQL infrastructure.

Instead of flattening `projects`, `issues`, and `comments` into repeated rows and rebuilding the tree yourself, you can express the hierarchy directly in the query:

```typescript
import { createLiveQueryCollection, eq } from '@tanstack/db'

const projectsWithIssues = createLiveQueryCollection((q) =>
  q.from({ p: projectsCollection }).select(({ p }) => ({
    id: p.id,
    name: p.name,
    issues: q
      .from({ i: issuesCollection })
      .where(({ i }) => eq(i.projectId, p.id))
      .select(({ i }) => ({
        id: i.id,
        title: i.title,
        comments: q
          .from({ c: commentsCollection })
          .where(({ c }) => eq(c.issueId, i.id))
          .select(({ c }) => ({
            id: c.id,
            body: c.body,
          })),
      })),
  })),
)
```

The query above fetches all projects and, for each one, includes its issues and each issue's comments through nested sub-queries. The result is a collection of `{ id, name, issues }` objects where the nested fields are also collections.

### Why this is different

The key detail is that the entire nested query runs as **one incremental query graph**.

- avoids the N+1 problem
- builds a single query graph, not one per row
- batches server fetches for includes instead of issuing one request per row
- preserves TanStack DB’s fine-grained incremental update model

This is not just a projection API—it improves both performance and system behavior.

### Fine-grained reactivity by default

Includes also keep fine-grained reactivity intact.

By default, each included field is materialized as a **child collection**. The parent row does not re-render when child data changes. Instead, you pass the child collection to a child component, call `useLiveQuery(childCollection)`, and only that component updates.

This gives you a hierarchical UI shape without sacrificing TanStack DB’s granular reactivity, while centralizing data requirements instead of scattering them across components and loaders.

```typescript
import { useLiveQuery } from '@tanstack/react-db'
import { eq } from '@tanstack/db'

function ProjectList() {
  const { data: projects } = useLiveQuery((q) =>
    q.from({ p: projectsCollection }).select(({ p }) => ({
      id: p.id,
      name: p.name,
      issues: q
        .from({ i: issuesCollection })
        .where(({ i }) => eq(i.projectId, p.id))
        .select(({ i }) => ({
          id: i.id,
          title: i.title,
        })),
    })),
  )

  return (
    <ul>
      {projects.map((project) => (
        <li key={project.id}>
          <h3>{project.name}</h3>
          <IssueList issuesCollection={project.issues} />
        </li>
      ))}
    </ul>
  )
}

function IssueList({ issuesCollection }) {
  const { data: issues } = useLiveQuery(issuesCollection)

  return <ul>{issues.map((issue) => <li key={issue.id}>{issue.title}</li>)}</ul>
}
```

### `toArray()` when you want materialized projections

Sometimes a child collection is unnecessary. For simple aggregates, small lists (e.g. tags), or cases where a child render boundary adds overhead, `toArray()` lets you materialize the child query directly in the projection layer.

```typescript
import { createLiveQueryCollection, eq, toArray } from '@tanstack/db'

const projectsWithIssueTags = createLiveQueryCollection((q) =>
  q.from({ p: projectsCollection }).select(({ p }) => ({
    id: p.id,
    name: p.name,
    issues: toArray(
      q
        .from({ i: issuesCollection })
        .where(({ i }) => eq(i.projectId, p.id))
        .select(({ i }) => ({
          id: i.id,
          title: i.title,
        })),
    ),
  })),
)
```

With `toArray()`, the parent row is re-emitted when the child data changes. Without it, the child `Collection` updates independently.

### What shipped with includes

Includes in 0.6 support:

- arbitrarily nested subqueries, with child collections by default
- `toArray()` for materialized arrays when needed
- aggregates within child subqueries
- `orderBy()` and `limit()` inside subqueries
- child subqueries filtered by their parent row
- patterns that preserve fine-grained updates at each level across frameworks

Taken together, this is one of the largest additions in the release, making TanStack DB better suited for building application-shaped views over normalized data.

## `createEffect`: reactive side effects for workflows, tools, and agents

`createEffect` adds a reactive side-effect layer on top of live queries.

It behaves like a database trigger, but operates on the result of an arbitrary live query rather than writes to a single table. Side effects are defined from the shape of the data you care about, not just low-level mutations.

Effects do **not** materialize the full query result into a collection. They run incrementally on query-result deltas, keeping memory usage low and avoiding manual diffing. This aligns with the query engine’s incremental model and makes effects well-suited for workflow logic.

The three event types map directly to query-result transitions:

- `enter`: a row has entered the query result
- `update`: a row changed but stayed in the query result
- `exit`: a row left the query result

Effects can be triggered by both local changes and synced updates. This supports standard workflow automation and extends naturally to agent-style systems: persist jobs or generations in a collection, define a query for items ready to run, and use `onEnter` to trigger the next step. State lives in TanStack DB, workflows react to query results, and the UI updates from the same source of truth.

```typescript
import { createEffect, eq } from '@tanstack/db'

const effect = createEffect({
  query: (q) =>
    q
      .from({ job: agentJobsCollection })
      .where(({ job }) => eq(job.status, 'ready')),
  skipInitial: true,
  onEnter: async (event, ctx) => {
    await runAgentStep(event.value, { signal: ctx.signal })
  },
  onError: (error, event) => {
    console.error(`Failed to run job ${event.key}:`, error)
  },
})

// Later
await effect.dispose()
```

Combined with [persistent local state](#persistent-local-state) in environments like Cloudflare Durable Objects, TanStack DB starts to resemble a durable state engine for agent workflows, not just a UI data layer.

This is one example, but it highlights how the 0.6 features work together: [includes](#includes-project-your-data-into-the-same-shape-as-your-ui), [virtual props](#virtual-props-outboxes-delivery-state-and-row-provenance), and reactive effects compose into something more capable than any single feature in isolation.

## Virtual props: outboxes, delivery state, and row provenance

Virtual props make row state visible directly in the query layer.

They are:

- `$synced`: whether the row is confirmed by sync or still only local/optimistic
- `$origin`: whether the last confirmed change came from this client or from upstream sync
- `$key`: the row key for the result
- `$collectionId`: the source collection ID

They can be used for workflow automation with `createEffect`, but are also immediately useful in the UI:

- outbox views of unpersisted data
- delivery or sync state indicators
- double-tick style UI patterns (e.g. WhatsApp)

Virtual props are one of those deceptively small features that end up being useful everywhere.

```typescript
import { createLiveQueryCollection, eq } from '@tanstack/db'

const outbox = createLiveQueryCollection({
  id: `outbox`,
  query: (q) =>
    q
      .from({ item: messagesCollection })
      .where(({ item }) => eq(item.$synced, false))
      .select(({ item }) => ({
        id: item.id,
        body: item.body,
        synced: item.$synced,
        origin: item.$origin,
      })),
})
```

That query can drive a full outbox view, or smaller UI elements like delivery indicators in a chat interface. Because these props are queryable, they also pair naturally with [createEffect](#createeffect-reactive-side-effects-for-workflows-tools-and-agents) when you want workflows driven by optimistic or confirmed state transitions.

## queryOnce

Not every query needs to stay live.

`queryOnce` gives TanStack DB a clean one-shot execution path for things like:

- loaders
- scripts
- exports
- tests
- AI and LLM context building

It is a small feature, but it completes the API in an important way. You can now use the same query language for both reactive and one-off reads.

```typescript
import { eq, queryOnce } from '@tanstack/db'

const activeUsers = await queryOnce((q) =>
  q
    .from({ user: usersCollection })
    .where(({ user }) => eq(user.active, true))
    .select(({ user }) => ({ id: user.id, name: user.name })),
)
```

## Migration notes

0.6 also includes a few API cleanups and typing changes that are worth checking when you upgrade.

### Cleaner nullable join typing

This one is subtle, but important.

TanStack DB uses JavaScript proxies in the declarative query builder to trace expressions like `dept.name` and turn them into query IR. In outer joins, the _resolved value_ may be optional in the final result, but **inside the query builder the proxy itself always exists**. Previously, types sometimes exposed joined refs as optional, implying you needed conditional logic in the query expression. That was misleading and led to bugs.

In 0.6, optionality has been removed from the proxy shape and moved to a type parameter on the ref itself. Editor hints still reflect nullability, and the final query result type remains correct, but the expression-builder API is now cleaner and more accurate to how it actually works.

Existing code will generally keep working, but stricter type checking may now flag places where code was relying on the old, misleading optional-ref typing.

### Indexes are now opt-in

Indexing is no longer something you silently get by default. In 0.6, you opt into the indexing machinery when you want it.

The key configuration is:

- `defaultIndexType`: the **new** option that tells TanStack DB which index implementation to create when an index is needed
- `autoIndex`: the **existing** option that controls whether TanStack DB should automatically create indexes for simple queries

That gives you three practical modes:

- **No indexing**: omit indexing entirely. Smaller bundles, but queries may scan local data on startup.
- **Auto indexing**: set a `defaultIndexType` and enable `autoIndex: 'eager'`. Indexes are created on demand.
- **Manual indexing**: call [`collection.createIndex(...)`](https://tanstack.com/db/latest/docs/reference/interfaces/Collection#createindex) for specific fields, using either a collection-level `defaultIndexType` or per-index `indexType`.

These modes existed before. The change in 0.6 is that indexing code is no longer included in the bundle unless you opt in.

When enabled, two index implementations are available:

- `BasicIndex` from `@tanstack/db/indexing`: lightweight, minimal bundle impact; uses a `Map` + array; slower updates on larger collections
- `BTreeIndex` from `@tanstack/db/indexing`: heavier B+tree-based option; better for larger or more demanding datasets; higher bundle cost

```typescript
import { createCollection } from '@tanstack/db'
import { BasicIndex } from '@tanstack/db/indexing'

const collection = createCollection({
  defaultIndexType: BasicIndex,
  autoIndex: 'eager',
  // ...
})
```

### Magic return removal

We are removing the “magic return” behavior from mutation handlers in favor of a more explicit, uniform model. The explicit options already existed; 0.6 standardizes on using them.

The rule is simple: **when your mutation handler promise resolves, the optimistic state is removed.**

If you need to coordinate sync behavior, do it explicitly in the handler rather than relying on implicit return values. This makes the API easier to reason about and consistent across collection types.

```typescript
// QueryCollection before: implicit "magic return" behavior
onInsert: async ({ transaction }) => {
  await writeToBackend(transaction)
  return { refetch: false }
}

// QueryCollection after: explicit sync coordination
onInsert: async ({ transaction, collection }) => {
  await writeToBackend(transaction)
  await collection.utils.refetch()
}

// ElectricCollection before: implicit txid return
onInsert: async ({ transaction }) => {
  const txid = await writeToBackendAndReturnTxId(transaction)
  return { txid }
}

// ElectricCollection after: explicit txid waiting
onInsert: async ({ transaction, collection }) => {
  const txid = await writeToBackendAndReturnTxId(transaction)
  await collection.utils.awaitTxId(txid)
}
```

## Toward v1: help us get SSR right

TanStack DB 0.6 closes a lot of the gaps people were experiencing.

One major piece remains on the path to v1: **server-side rendering (SSR)**. We want to get this right.

TanStack DB differs from TanStack Query and traditional API-driven architectures. The SSR story is not simply “do what Query does, but for DB.” It involves a different execution model, a different relationship between local and remote state, and different tradeoffs around hydration, persistence, and live updates.

Rather than shipping a shallow solution, we are working with design partners to shape this properly. We are exploring SSR support and want input from teams planning to use TanStack DB in production.

If that applies to you, fill out the form and share details about your app, constraints, and what a strong SSR model would require. We will set up calls with teams, interview them to understand the requirements and run proposals past them as we shape the design.

- [Fill out the SSR design partner form](https://docs.google.com/forms/d/e/1FAIpQLSdoCZ_Z5uODArGpGkVI4tbU7q9qHAcGAXYYEoP9HFq3aKNs3A/viewform?usp=publish-editor).

If you have been waiting for TanStack DB to feel more complete, more durable, and more application-shaped, 0.6 is a big step in that direction.

And if you want to help shape the final piece on the road to v1, we would love to hear from you.
