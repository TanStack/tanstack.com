---
title: TanStack DB 0.6 Now Includes Persistence, Offline Support, and Hierarchical Data
excerpt: TanStack DB 0.6 adds SQLite-backed persistence across runtimes, hierarchical includes for projecting normalized data into UI-shaped trees, reactive effects, virtual props for sync state, and more.
published: 2026-03-19
draft: true
authors:
  - Sam Willis
  - Kevin De Porre
---

![Persistence, Offline Support, and Hierarchical Data](/blog-assets/tanstack-db-0.6-app-ready-with-persistence-and-includes/header.jpg)

TanStack DB 0.6 is the release that lands some highly anticipated features that many of you have been asking for, making it a lot more ergonomic for app development.

You can now project normalized data into the same hierarchical structure as your UI. You can optionally persist local state with a SQLite-backed persistence layer across runtimes. You can trigger reactive side effects from live queries. You can build outbox views and WhatsApp-style delivery indicators directly from row metadata. And a few APIs that used to rely on implicit magic are now getting more explicit and uniform.

Here is what shipped:

- [Persisted local state](#persisted-local-state) with an optional SQLite-backed persistence layer across browser, React Native, Expo, Node, Electron, Capacitor, Tauri, and Cloudflare Durable Objects
- [Includes](#includes-project-your-data-into-the-same-shape-as-your-ui) for projecting normalized data into the same hierarchical structure as your UI. Similar to GraphQL, but without the need for new infrastructure.
- [`createEffect`](#createeffect-reactive-side-effects-for-workflows-tools-and-agents) for workflows, side effects, and agent-style automation
- [Virtual props](#virtual-props-outboxes-delivery-state-and-row-provenance) like `$synced` and `$origin` for outbox views, sync indicators, and provenance-aware queries
- [`queryOnce`](#queryonce) for one-shot queries using the same query language as live queries
- Indexes are now opt-in, and we removed the magic return behavior from mutation handlers - see [migration notes](#migration-notes) for details

If you have been watching TanStack DB and waiting for it to feel like a more complete application data layer, this is the release for you.

If you're upgrading an existing app, you can jump straight to the [migration notes](#migration-notes).

Finally, we are also putting out [a call for server-side rendering (SSR) design partners](#toward-v1-help-us-get-ssr-right) as we work toward v1.

## Shopping List Demo App

One of the best examples of what 0.6 unlocks is our React Native shopping list demo.

> Demo video embed coming soon.

It starts up from persisted SQLite state through `op-sqlite`, projects normalized data into a hierarchical UI shape with [includes](#includes-project-your-data-into-the-same-shape-as-your-ui), and still keeps TanStack DB's fine-grained reactivity underneath. But the really important thing is what that persistence unlocks when you pair it with [`@tanstack/offline-transactions`](https://github.com/TanStack/db/tree/main/packages/offline-transactions).

TanStack DB already had the query engine, transaction model, optimistic updates, and the offline transaction API. Persistence was the missing piece. Once local state is durable, that stack can add up to something fully local-first instead of only feeling local while the app is open.

### More than local-first

Persistence is the feature people asked for, but it does not define TanStack DB. The core idea is simpler: put a real query engine and transaction engine on the client, and let storage and synchronization live wherever they belong. Local-first is one configuration of that. Server-authoritative with fast optimistic updates is another. The same primitives support both.

## Persisted local state

Persistence is the biggest practical unlock in 0.6.

We have wanted a persistence story for a while, and a lot of you have asked for it too. The problem space was always broader than just "save some rows to disk":

- persistence is not only about faster startup
- it needs to compose with synced remote state and optimistic local state
- it needs to work across multiple runtimes
- it needs to support large datasets without assuming everything lives in memory
- it needs to work across multiple tabs and windows
- and it needs a sane story for schema evolution

That led us to a pragmatic choice: **use SQLite as the persistence layer**.

That gives TanStack DB one persistence model that can span:

- browser via a WASM build of SQLite
- React Native and Expo
- Node
- Electron
- Tauri
- Capacitior
- Cloudflare Durable Objects

Instead of inventing a different storage story for each environment, we can keep one persistence model and swap in runtime-specific adapters. The result is optional persisted local state that can enable a local-first application, without limiting TanStack DB to only local-first use cases.

For synced collections, persistence does **not** change the source of truth. The server is still authoritative. Persistence gives you a durable local base to start from quickly, work against offline, and then reconcile back to the upstream source of truth when sync resumes.

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

That gives you a durable local base for a synced collection. Pair it with `@tanstack/offline-transactions`, and you also get durable writes for a fully local-first flow.

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

`schemaVersion` is the switch that keeps those two modes honest. For synced collections, changing it tells TanStack DB to clear the persisted local copy and re-sync from the server. For unsynced local-only collections, changing it throws and requires the application to migrate the data itself.

That same persistence story also opens the door to runtimes outside the UI. As you'll see later in [createEffect](#createeffect-reactive-side-effects-for-workflows-tools-and-agents), a persisted TanStack DB running in something like a Cloudflare Durable Object starts to look a lot like a state engine for workflows and agents.

### Why SQLite

Using SQLite in the browser is the pragmatic choice for users and for the project.

We considered a split design where the browser would use IndexedDB directly to avoid the SQLite WASM download. But that would have meant a more awkward indexing model, more awkward connection management, and a split query architecture where the browser behaved differently from every other runtime. One of the sharpest edges was that adding indexes required disconnecting all active connections first, which does not play well with the dynamic nature of TanStack DB.

Standardizing on one persistence engine keeps the design simpler and lets us carry the same persistence model into mobile, desktop, server, edge, and agent-style runtimes instead of inventing a different system for each one.

We also weighed the cost of the WASM bundle. In practice, if users are already syncing data to the user's device, the extra cost of shipping SQLite WASM is relatively small. They are already pulling down meaningful application data, so paying a bit more upfront for a much cleaner persistence and query model felt like the right tradeoff.

### Why this matters

In practice, 0.6 gives you:

- apps can restart warm instead of cold
- local state, both synced and pending mutations, can survive reloads and app restarts
- offline-friendly UX becomes much more practical
- the same DB mental model can move between mobile, browser, desktop, server, edge, and agent runtimes

This is the first _alpha_ release of persistence, and so we are looking for feedback and testing - we want to hear your feedback.

## Includes: project your data into the same shape as your UI

All UIs are hierarchical.

But most data systems make you choose between flat relational queries that you then reshape manually, or nested loading patterns that create N+1 query problems and duplicated work.

GraphQL tackles a similar problem from the server side: give the UI a hierarchical shape without forcing every client to manually stitch flat records back together.

`includes` is TanStack DB's answer to that same problem from the client side. It lets you retrieve normalized data and project it directly into the hierarchical structure your UI wants to render, over any data source TanStack DB can sit on top of, without needing GraphQL-specific infrastructure.

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
      })),
  })),
)
```

The query above fetches all projects and, for each one, includes its issues by means of a nested query on the issues collection. The result is a collection of `{ id, name, issues }` objects where the issues themselves are also collections.

### Why this is different

The key thing here is that the whole nested query is executed as **one incremental query graph**.

- it avoids the N+1 problem
- it builds one query graph, not one per row
- if the engine has to go back to the server for multiple rows of an include, it does that once, not once per row
- it keeps the same fine-grained incremental update model as the rest of TanStack DB

So this is not just a nicer projection API. It is also a performance and systems story.

### Fine-grained reactivity by default

Includes also keep fine-grained reactivity intact.

By default, each included field is materialized as a **child collection**. The parent row does not need to re-render when the child data changes. You pass the child collection down to a child component, that child component calls `useLiveQuery(childCollection)`, and only that child component re-renders.

That gives you a hierarchical UI shape without giving up TanStack DB's granular reactive behavior, and it centralizes the definition of the data the UI needs in one place instead of scattering it across multiple components and loaders.

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

### `toArray()` when you want materialised projections

Sometimes you do not want a child collection. For simple aggregates, short lists like tags, or other places where you do not want a child render boundary, `toArray()` lets you materialize the child query directly in the projection layer.

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

- nested child collections by default
- `toArray()` when you want materialized arrays instead
- aggregates in child subqueries
- `orderBy()` and `limit()` inside subqueries
- child subqueries that filter based on their parent row
- arbitrarily nested subqueries
- usage patterns that preserve fine-grained updates at each level across all supported frameworks

Taken together, this is one of the biggest features in the release. It makes TanStack DB more suitable for building application-shaped views over normalized data.

## `createEffect`: reactive side effects for workflows, tools, and agents

`createEffect` adds a reactive side-effect layer on top of live queries.

You can think of it a little bit like a database trigger, except it runs on the result of an arbitrary live query instead of only on writes to a single table. That means you can define side effects from the shape of the data you care about, not just from raw mutations at the storage layer.

Effects also do **not** materialize the full result of the query into a collection first. They run incrementally on query-result deltas, which keeps them low-memory and makes them a much better fit for workflow logic than "subscribe to a whole collection and diff it yourself", especially because the query engine itself is already incremental.

The three event types map directly to query-result transitions:

- `enter`: a row has entered the query result
- `update`: a row changed but stayed in the query result
- `exit`: a row left the query result

Effects can be triggered by local changes and by changes received over sync. That is useful for classic workflow automation, but it gets especially interesting for AI and agent systems. Persist generations or jobs into a collection, define a query for the items that are ready to run, and use `onEnter` to trigger the next step. The state stays in TanStack DB, the workflow reacts to the query result, and the UI updates from the same source of truth.

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

Combined with [persisted local state](#persisted-local-state) in something like a Cloudflare Durable Object, TanStack DB starts to look like a durable state engine for agent workflows, not just a UI data layer. This is only one example, but it shows why the 0.6 features matter together: [includes](#includes-project-your-data-into-the-same-shape-as-your-ui), [virtual props](#virtual-props-outboxes-delivery-state-and-row-provenance), and reactive effects all compose into something much more powerful than any one feature on its own.

## Virtual props: outboxes, delivery state, and row provenance

Virtual props make row state visible directly in the query layer.

They are:

- `$synced`: whether the row is confirmed by sync or still only local/optimistic
- `$origin`: whether the last confirmed change came from this client or from upstream sync
- `$key`: the row key for the result
- `$collectionId`: the source collection ID

That gives you access to state that used to be awkward or bolted on.

You can use them for workflow automation together with `createEffect`, but they are also immediately useful for UI:

- an outbox view of un-persisted data
- a delivery or sync state badge
- the little double-tick style UI we are used to from apps like WhatsApp

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

That query can power a literal outbox view, or something smaller like a delivery indicator in a chat UI. And because the same props are queryable, they also pair naturally with [createEffect](#createeffect-reactive-side-effects-for-workflows-tools-and-agents) when you want workflow behavior driven by optimistic or confirmed state transitions.

## queryOnce

Not every query needs to stay live.

`queryOnce` gives TanStack DB a clean one-shot execution path for things like:

- loaders
- scripts
- exports
- tests
- AI and LLM context building

It is a small feature, but it rounds out the API in an important way. You can now use the same query language for both reactive and one-off reads.

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

TanStack DB uses JavaScript proxies inside the declarative query builder to trace expressions like `dept.name` and turn them into query IR. In outer joins, the _resolved value_ might be optional in the final result, but **inside the query builder the proxy itself still exists**. Previously, the types sometimes exposed joined refs as optional anyway, which implied you needed to write conditional JavaScript logic in the query expression itself. That was misleading, and it led to real bugs.

In 0.6, that optionality has been removed from the proxy shape and moved onto a type parameter on the ref itself. That means editor hints can still tell you the joined side is nullable, and TanStack DB can still project the correct optionality into the final query result type, but the expression-builder API is now much tidier and much more honest about how it actually works.

Existing code will generally keep working, but stricter type checking may now flag places where code was relying on the old, misleading optional-ref typing.

### Indexes are now opt-in

Indexing is no longer something you silently get by default. In 0.6, you opt into the indexing machinery when you want it.

The key configuration is:

- `defaultIndexType`: the **new** option that tells TanStack DB which index implementation to create when an index is needed
- `autoIndex`: the **existing** option that controls whether TanStack DB should automatically create indexes for simple queries

That gives you three practical modes:

- **No indexing**: leave indexing out entirely. You get smaller bundles by default, but TanStack DB may do a full scan of local data on query start for each predicate instead of using an index.
- **Auto indexing**: choose a `defaultIndexType` and enable `autoIndex: 'eager'`. TanStack DB will create indexes on demand as queries need them.
- **Manual indexing**: explicitly call [`collection.createIndex(...)`](https://tanstack.com/db/latest/docs/reference/interfaces/Collection#createindex) for the fields you want to index, either using a collection-level `defaultIndexType` or an `indexType` per index.

Those modes already existed. What changed in 0.6 is that the default indexing code is no longer pulled into the bundle unless you opt into it.

When you do opt in, there are two built-in index implementations:

- `BasicIndex` from `@tanstack/db/indexing`: the lighter-weight option and a good default when you want indexing with minimal bundle impact. It uses a JavaScript `Map` plus an array internally, which keeps the bundle small but can be slower to update on larger collections.
- `BTreeIndex` from `@tanstack/db/indexing`: the heavier B+tree-based option for bigger or more demanding collections. It gives you a stronger index structure, but with a correspondingly higher bundle cost.

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

We are also removing the "magic return" behavior from mutation handlers in favor of the more explicit and uniform model. The explicit options were already there. They are not new in 0.6. What is changing is that we are standardizing on one clear way to do it.

The important rule is simple:

**when your mutation handler promise resolves, the optimistic state is removed.**

If you need to coordinate sync behavior, do it explicitly in the handler rather than through implicit return values. This makes the API easier to reason about and more consistent across collection types.

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

But there is still one major missing piece on the path to v1: **server-side rendering (SSR)**, and we want to get it right.

TanStack DB is different from TanStack Query and from a classic API-driven application architecture. The SSR story is not just "do what Query does, but for DB". DB has a different execution model, a different relationship between local and remote state, and a different set of tradeoffs around hydration, persistence, and live updates.

So rather than rushing into a shallow solution, we want design partners. We are actively exploring the shape of SSR support for TanStack DB, and we want to hear from teams who are interested in using it seriously.

If that is you, please fill out the design partner form and tell us about your app, your constraints, and what a good SSR story for DB would need to look like. We will set up calls with teams, interview them to understand the requirements, and run proposals past them as we shape the design.

- SSR design partner form link coming soon.

If you have been waiting for TanStack DB to feel more complete, more durable, and more application-shaped, 0.6 is a big step in that direction.

And if you want to help shape the final piece on the road to v1, we would love to hear from you.
