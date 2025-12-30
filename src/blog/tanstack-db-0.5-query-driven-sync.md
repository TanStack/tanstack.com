---
title: TanStack DB 0.5 .  Query-Driven Sync
published: 2025-11-12
authors:
  - Sam Willis
  - Kevin De Porre
  - Kyle Mathews
---

![Query-Driven Sync](/blog-assets/tanstack-db-0.5-query-driven-sync/header.png)

You don't need a new API for every component. With 0.5, the component's query _is_ the API call.

```tsx
// Your component's query...
const { data: projectTodos } = useLiveQuery((q) =>
  q
    .from({ todos })
    .join({ projects }, (t, p) => eq(t.projectId, p.id))
    .where(({ todos }) => eq(todos.status, 'active'))
    .where(({ projects }) => eq(projects.id, 123)),
)

// ...becomes these precise API calls automatically:
// GET /api/projects/123
// GET /api/todos?projectId=123&status=active
```

No custom endpoint. No GraphQL resolver. No backend change. Just write your query and TanStack DB figures out exactly what to fetch.

We're releasing TanStack DB 0.5 today with Query-Driven Sync. A feature that fundamentally changes how you think about loading data.

## Pure queries over data

React's breakthrough was making components pure functions of state: `UI = f(state)`. You describe what you want to render, React handles the how.

TanStack DB brings the same philosophy to data: `view = query(collections)`. You describe what data you need. **DB handles the fetching, caching, and updating**, even across 100k+ row datasets.

```tsx
// Pure view over state
function TodoList({ todos, filter }) {
  return todos
    .filter((t) => t.status === filter)
    .map((t) => <TodoItem todo={t} />)
}

// Pure query over data
function TodoList({ filter }) {
  const { data: todos } = useLiveQuery(
    (q) =>
      q
        .from({ todos: todoCollection })
        .where(({ todos }) => eq(todos.status, filter)),
    [filter],
  )
  return todos.map((t) => <TodoItem todo={t} />)
}
```

The difference? React recomputes the view when state changes. TanStack DB recomputes the _query_ when data changes. And optimizes the network calls automatically.

## The reactive client-first store for your API

TanStack DB is a client-first store for your API powered by [differential dataflow](https://github.com/TimelyDataflow/differential-dataflow). A technique that recomputes only what changed. When you mark a todo complete, DB updates query results in <1ms on a modern laptop, even with 100,000+ rows in memory.

This isn't just fast filtering. It's **live queries** that incrementally maintain themselves as data changes. **Effortless optimistic mutations** that instantly update all affected queries, then reconcile with the server. And a **normalized collection store** that eliminates duplicate data and keeps everything coherent.

[When we released TanStack DB 0.1](/blog/tanstack-db-0.1-the-embedded-client-database-for-tanstack-query) in July, we described the two options teams face and that TanStack DB enables a new Option, C:

> **Option A. View-specific APIs** (fast render, slow network, endless endpoint sprawl)
>
> **Option B. Load-everything-and-filter** (simple backend, sluggish client)
>
> **Option C. Normalized collections + differential dataflow** (load once, query instantly, no jitter)

## The problem we kept hearing about

Since we released the first beta in July, we've gotten the same question over and over:

> This looks great for loading normalized data once, but what if my `users` table has 100,000 rows? I can't load everything.

They're right. Before 0.5, collections loaded their entire dataset upfront. That works beautifully for many apps with datasets in the thousands of rows, but it's not a one-size-fits-all solution.

Here's what we realized: **a collection shouldn't dictate what data loads. Your queries should.**

A collection defines the _schema_ and _security boundaries_ for a data domain. Your live queries define _which subset_ of that domain to load right now.

## Three sync modes: Pick the right loading strategy

This led to three sync modes, each optimized for different use cases:

**Eager mode (default & only mode before v0.5):** Load entire collection upfront. Best for <10k rows of mostly static data: user preferences, small reference tables.

**On-demand mode:** Load only what queries request. Best for large datasets (>50k rows), search interfaces, catalogs where most data won't be accessed.

**Progressive mode:** Load query subset immediately, sync full dataset in background. Best for collaborative apps where you want instant first paint AND sub-millisecond queries for everything else.

Most apps use a mix. Your user profile? Eager. Your products catalog? On-demand. Your shared project workspace? Progressive.

Let's see how each works.

## On-demand sync: Your query becomes the API call

With 0.5, you add one line to your collection:

```tsx
const productsCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['products'],
    queryFn: async (ctx) => {
      // Parse your query predicates into API parameters
      const params = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions)

      // GET /api/products with query-specific filters
      return api.getProducts(params)
    },
    syncMode: 'on-demand', // ← New!
  }),
)
```

Now when you write this query:

```tsx
const { data: electronics } = useLiveQuery((q) =>
  q
    .from({ product: productsCollection })
    .where(({ product }) =>
      and(eq(product.category, 'electronics'), lt(product.price, 100)),
    )
    .orderBy(({ product }) => product.price, 'asc')
    .limit(10),
)
```

TanStack DB automatically calls your `queryFn` with:

```
GET /api/products?category=electronics&price_lt=100&sort=price:asc&limit=10
```

**No custom API endpoint.** **No GraphQL schema changes.** Just a general-purpose products API that accepts filter parameters.

Your component's query becomes the API call.

If you're familiar with Relay or Apollo, this should feel familiar: components declare their data needs, and the framework optimizes fetching and updates. The difference? You get Relay-style normalized caching and automatic updates without GraphQL. Your REST, GraphQL, or tRPC API stays simple, your queries stay powerful, and differential dataflow keeps everything fast client-side.

## Request Economics: Smarter than it looks

"Wait," you're thinking, "doesn't this create N+1 query problems?"

No. And here's why the performance story is actually _better_ than custom APIs.

### **Automatic request collapsing**

Multiple components requesting the same data trigger exactly one network call:

```tsx
// Component A
const { data: active } = useLiveQuery((q) =>
  q.from({ todos }).where(({ todos }) => eq(todos.status, 'active')),
)

// Component B (same query, different component)
const { data: active } = useLiveQuery((q) =>
  q.from({ todos }).where(({ todos }) => eq(todos.status, 'active')),
)

// Result: ONE network request
// GET /api/todos?status=active
```

TanStack DB compares predicates across all live queries and deduplicates requests automatically.

### **Subset matching and delta loading**

When you navigate from viewing 10 products to viewing 20, DB doesn't reload everything:

```tsx
// Initial query: loads 10 products
const { data } = useLiveQuery((q) => q.from({ products }).limit(10))

// User clicks "load more": loads ONLY the next 10
fetchNextPage()
```

```
# Page 1
GET /api/products?limit=10&offset=0

# Page 2
GET /api/products?limit=10&offset=10
# NOT: GET /api/products?limit=20
```

Already-loaded rows are reused; only the new window crosses the wire. The collection tracks which predicates it has already satisfied and only fetches the delta.

### **Join optimization**

Complex joins don't cause request explosions. They trigger a minimal set of filtered requests:

```tsx
// Join todos with their projects
const { data } = useLiveQuery((q) =>
  q
    .from({ todos })
    .join({ projects }, (t, p) => eq(t.projectId, p.id))
    .where(({ todos }) => eq(todos.status, 'active')),
)

// Network calls:
// GET /api/todos?status=active        (returns 10 todos)
// GET /api/projects?id_in=123,124,125 (only the 3 unique project IDs)
//
// NOT 10 separate project requests!
```

DB analyzes the join to determine exactly which related records are needed, then fetches them in a single batched request.

### **Respects your cache policies**

Query Collection integrates with TanStack Query's `staleTime` and `gcTime`:

```tsx
const productsCollection = createCollection(queryCollectionOptions({
  queryKey: ['products'],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000, // 5 minutes
  syncMode: 'on-demand'
}))

// First query: network request
useLiveQuery(q => q.from({ products }).where(...))

// Same query within 5 minutes: instant, no network
useLiveQuery(q => q.from({ products }).where(...))

// Different query within 5 minutes: only fetches the diff
useLiveQuery(q => q.from({ products }).where(...).limit(20))
```

You get TanStack Query's sophisticated caching plus DB's intelligent subset tracking.

**The result:** Fewer total network requests than custom view-specific APIs, with better cache utilization and zero endpoint sprawl.

## Progressive sync: Fast initial paint + instant client queries

On-demand mode is great for search interfaces and catalogs where you'll never touch most of the data. But what about collaborative apps where you _want_ the full dataset client-side for instant queries and offline access, but also want fast first paint?

That's progressive mode: load what you need immediately, sync everything in the background.

```tsx
const todoCollection = createCollection(
  electricCollectionOptions({
    table: 'todos',
    syncMode: 'progressive',
  }),
)

// First query loads immediately (on-demand)
const { data: urgentTodos } = useLiveQuery((q) =>
  q
    .from({ todos: todoCollection })
    .where(({ todos }) => eq(todos.priority, 'urgent')),
)
// ~100ms: Network request for urgent todos only

// Meanwhile, collection syncs full dataset in background
// After sync completes: all queries run in <1ms client-side
```

Now your first query loads in ~100ms with a targeted network request. While the user interacts with that data, the full dataset syncs in the background. Once complete, all subsequent queries (even complex joins and filters) run in sub-millisecond time purely client-side.

**Progressive mode shines with sync engines** like Electric, Trailbase, and PowerSync. With traditional fetch approaches, loading more data means re-fetching everything, which gets expensive fast. But sync engines only send deltas (the actual changed rows), making it cheap to maintain large client-side datasets. You get instant queries over 10,000s of rows without the network cost of repeatedly fetching all that data.

With REST APIs, progressive mode is less common since updates generally require full re-fetches. But for sync engines, it's often the sweet spot: fast first paint + instant everything else.

## Works today with REST. Gets better with sync engines.

Query-Driven Sync is designed to work with your existing REST, GraphQL, or tRPC APIs. No backend migration required: just map your predicates to your API's parameters (as shown below) and you're done.

For teams using sync engines like [Electric](https://electric-sql.com), [Trailbase](https://trailbase.io/), or [PowerSync](https://www.powersync.com/), you get additional benefits:

- **Real-time updates** via streaming (no polling required)
- **Automatic predicate translation** (no manual mapping needed)
- **Delta-only syncing** (only changed rows cross the wire)

For example, Electric translates your client query directly into Postgres queries, applies authorization rules, and streams updates. Your component's query becomes a secure, real-time, authorized Postgres query, no API endpoint needed.

Collections abstract the data source. Start with REST. Upgrade to sync when you need real-time.

## How Query Collection predicate mapping works

Query Collection is designed for REST, GraphQL, tRPC, and any other API-based backend. When you enable `syncMode: 'on-demand'`, TanStack DB automatically passes your query predicates (where clauses, orderBy, limit) to your `queryFn` as expression trees in `ctx.meta.loadSubsetOptions`. You write the mapping logic once to translate these into your API's format.

We provide helper functions to make this straightforward:

```tsx
queryFn: async (ctx) => {
  // Parse expression trees into a simple format
  const { filters, sorts, limit } = parseLoadSubsetOptions(
    ctx.meta?.loadSubsetOptions,
  )

  // Map to your REST API's query parameters
  const params = new URLSearchParams()
  filters.forEach(({ field, operator, value }) => {
    if (operator === 'eq') params.set(field.join('.'), String(value))
    else if (operator === 'lt')
      params.set(`${field.join('.')}_lt`, String(value))
    // Map other operators as needed
  })
  if (limit) params.set('limit', String(limit))

  return fetch(`/api/products?${params}`).then((r) => r.json())
}
```

For APIs with custom formats (like GraphQL), use `parseWhereExpression` with custom handlers:

```tsx
queryFn: async (ctx) => {
  const { where, orderBy, limit } = ctx.meta?.loadSubsetOptions

  // Map to GraphQL's where clause format
  const whereClause = parseWhereExpression(where, {
    handlers: {
      eq: (field, value) => ({ [field.join('_')]: { _eq: value } }),
      lt: (field, value) => ({ [field.join('_')]: { _lt: value } }),
      and: (...conditions) => ({ _and: conditions }),
    },
  })

  // Use whereClause in your GraphQL query...
}
```

You write this mapping once per collection. After that, every query automatically generates the right API calls.

**Can't modify your API?** Your mapping doesn't need to be precise. Many queries can map to a single broad API call. For example, any product search query with category "hardware" could map to `GET /api/products?category=hardware`. TanStack DB will apply the remainder of the query client-side. As your API evolves to support more predicates, your client code doesn't change: just update the mapping to push down more filters. Start broad, optimize incrementally.

[Full Query Collection predicate mapping documentation →](https://tanstack.com/db/latest/docs/collections/query-collection#queryfn-and-predicate-push-down)

## Shipping toward 1.0

Query-Driven Sync (0.5) completes the core vision: intelligent loading that adapts to your queries, instant client-side updates via differential dataflow, and seamless persistence back to your backend. We're targeting 1.0 for December 2025, focusing on API stability and comprehensive docs.

**This is new. We need early adopters.** Query-Driven Sync works and ships today, but it's fresh. If you try it, we'd love your feedback on rough edges or API improvements. Join us in [Discord](https://discord.gg/tanstack) or open [GitHub issues](https://github.com/TanStack/db/issues).

If you have ideas for new collection types based on Query-Driven Sync, please reach out. The interface is very powerful and we have lots of interesting ideas for how it can be used.

### Try it today

```bash
npm install @tanstack/react-db@latest
```

---

Collections define schemas and security boundaries. Queries define what loads and when. Your components define UIs. Finally, each concern is separate. And your data layer adapts to how you actually use it.
