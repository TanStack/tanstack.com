---
title: Stop Re-Rendering — TanStack DB, the Embedded Client Database for TanStack Query
published: 2025-07-30
authors:
  - Kyle Mathews
  - Sam Willis
---

![Stop rerendering](/blog-assets/tanstack-db-0.1/header.png)

**Your React dashboard shouldn't grind to a halt** just because one TODO turns from ☐ to ☑. Yet every optimistic update still kicks off a cascade of re-renders, filters, useMemos and spinner flashes.

If you’ve ever muttered “**why is this still so hard in 2025?**”—same.

TanStack DB is our answer: a client-side database layer powered by differential dataflow that plugs straight into your existing useQuery calls.

It recomputes only what changed—**0.7 ms to update one row in a sorted 100k collection** on an M1 Pro ([CodeSandbox](https://codesandbox.io/p/sandbox/bold-noyce-jfz9fs))

One early-alpha adopter, building a Linear-like application, swapped out a pile of MobX code for TanStack DB and told us with relief, “everything is now completely instantaneous when clicking around the app, even w/ 1000s of tasks loaded.”

### Why it matters

<style>
.code-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 20px 0;
}

.comparison-column {
  min-width: 0; /* Prevent overflow */
  overflow-x: auto;
}

.comparison-column pre {
  font-size: 14px; /* Slightly smaller font */
}

/* Diff highlighting styles */
.diff-remove {
  background-color: rgba(255, 129, 130, 0.2);
  position: relative;
}

.diff-remove::before {
  content: '-';
  position: absolute;
  left: -20px;
  color: #d73a49;
  font-weight: bold;
}

.diff-add {
  background-color: rgba(46, 160, 67, 0.2);
  position: relative;
}

.diff-add::before {
  content: '+';
  position: absolute;
  left: -20px;
  color: #28a745;
  font-weight: bold;
}

/* Mobile responsive - stack vertically on small screens */
@media (max-width: 768px) {
  .code-comparison {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  
  .comparison-column h3 {
    margin-top: 0;
  }
}
</style>

Today most teams face an ugly fork in the road:

**Option A. View-specific APIs** (fast render, slow network, endless endpoint sprawl) or

**Option B. Load-everything-and-filter** (simple backend, sluggish client).

Differential dataflow unlocks **Option C—load normalized collections once, let TanStack DB stream millisecond-level incremental joins in the browser**. No rewrites, no spinners, no jitter.

**Live queries, effortless optimistic writes, and a radically simpler architecture**—all incrementally adoptable.

_[Try out the TanStack DB Starter](https://github.com/TanStack/db/tree/main/examples/react/projects)_

## So what’s happening under the hood?

TanStack DB keeps a **normalized collection store** in memory, then uses **differential dataflow** to update query results incrementally. Think of it like Materialize-style streaming SQL—except embedded in the browser and hooked straight into React Query’s cache.

- **Collections** wrap your existing `useQuery` calls (REST, tRPC, GraphQL, WebSocket—doesn’t matter). Do you sync data some other way? [Build a custom collection](https://tanstack.com/db/latest/docs/collection-options-creator).
- **Transactions** let you mutate those collections optimistically; failures roll back automatically.
- **Live queries** declare _what_ data you need; TanStack DB streams only the rows that change, in < 1 ms.

Put differently: **TanStack Query still owns “how do I fetch?”**; **TanStack DB owns “how do I keep everything coherent and lightning-fast once it’s here?”**

And because it’s just another layer on top of `queryClient`, you can adopt it one collection at a time.

## TanStack Query → TanStack DB

Imagine we already have a backend with a REST API that exposes the `/api/todos` endpoint to fetch a list of todos and mutate them.

<div class="code-comparison">
<div class="comparison-column">

### Before: TanStack Query

```typescript
import {
  useQuery,
  useMutation,
  useQueryClient, // ❌ Not needed with DB
} from '@tanstack/react-query'

const Todos = () => {
  const queryClient = useQueryClient() // ❌

  // Fetch todos
  const { data: allTodos = [] } = useQuery({
    queryKey: ['todos'],
    queryFn: async () =>
      api.todos.getAll('/api/todos'),
  })

  // Filter incomplete todos
  // ❌ Runs every render unless memoized
  const todos = allTodos.filter(
    (todo) => !todo.completed
  )

  // ❌ Manual optimistic update boilerplate
  const addTodoMutation = useMutation({
    mutationFn: async (newTodo) =>
      api.todos.create(newTodo),
    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({
        queryKey: ['todos'],
      })
      const previousTodos =
        queryClient.getQueryData(['todos'])
      queryClient.setQueryData(
        ['todos'],
        (old) => [...(old || []), newTodo]
      )

      return { previousTodos }
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(
        ['todos'],
        context.previousTodos
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['todos'],
      })
    },
  })

  return (
    <div>
      <List items={todos} />
      <Button
        onClick={() =>
          addTodoMutation.mutate({
            id: uuid(),
            text: '🔥 Make app faster',
            completed: false,
          })
        }
      />
    </div>
  )
}
```

</div>
<div class="comparison-column">

### After: TanStack DB

```typescript
// ✅ Define a Query Collection
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

const todoCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['todos'],
    queryFn: async () =>
      api.todos.getAll('/api/todos'),
    getKey: (item) => item.id, // ✅ New
    schema: todoSchema, // ✅ New
    onInsert: async ({ transaction }) => {
      // ✅ New
      await Promise.all(
        transaction.mutations.map((mutation) =>
          api.todos.create(mutation.modified)
        )
      )
    },
  })
)

// ✅ Use live queries in components
import { useLiveQuery } from '@tanstack/react-db'
import { eq } from '@tanstack/db'

const Todos = () => {
  // ✅ Live query with automatic updates
  const { data: todos } = useLiveQuery((query) =>
    query
      .from({ todos: todoCollection })
      // ✅ Type-safe query builder
      // ✅ Incremental computation
      .where(({ todos }) =>
        eq(todos.completed, false)
      )
  )

  return (
    <div>
      <List items={todos} />
      <Button
        onClick={() =>
          // ✅ Simple mutation - no boilerplate!
          // ✅ Automatic optimistic updates
          // ✅ Automatic rollback on error
          todoCollection.insert({
            id: uuid(),
            text: '🔥 Make app faster',
            completed: false,
          })
        }
      />
    </div>
  )
}
```

</div>
</div>

## Why a new client store?

TanStack Query is incredibly popular with 12m (and counting) downloads per week. So why make something new like TanStack DB?

Query solves the hardest problems of server state management — intelligent caching, background synchronization, request deduplication, optimistic updates, and seamless error handling.

It's become the de facto standard because it eliminates the boilerplate and complexity of managing async data fetching while providing an excellent developer experience with features like automatic background refetching, stale-while-revalidate patterns, and powerful DevTools.

But Query treats data as isolated cache entries. Each query result is independent—there's no concept of relationships, live queries across multiple data sources, or reactive updates when one piece of data affects another. **You can't easily ask "show me all todos where the project status is active"** and watch the list update automatically when a project flips status.

TanStack DB fills this gap. While Query excels at fetching and caching server state, DB provides the missing reactive, relational layer on top. You get the best of both worlds: Query's robust server state management plus TanStack DB’s embedded client database that can join, filter, and reactively update across your entire data graph.

But it doesn’t just improve your current setup — it enables a new radically simplified architecture.

## TanStack DB enables a radically simplified architecture

Let's revisit the three options:

**Option A — View-Specific APIs**: Create view-specific API endpoints that return exactly what each component needs. Clean, fast, zero client-side processing. But now you're drowning in brittle API routes, dealing with network waterfalls when components need related data, and creating tight coupling between your frontend views and backend schemas.

**Option B — Load-everything-and-filter**: Load broader datasets and filter/process them client-side. Fewer API calls, more flexible frontend. But you slam into the performance wall — `todos.filter()`, `users.find()`, `posts.map()`, `useMemo()` everywhere, with cascading re-renders destroying your UX.

Most teams pick Option A to avoid performance problems. You're trading client-side complexity for API proliferation and network dependency.

**TanStack DB enables Option C – Normalized Collections + Incremental Joins:** Load normalized collections through fewer API calls, then perform lightning-fast incremental joins in the client. You get the network efficiency of broad data loading with sub-millisecond query performance that makes Option A unnecessary.

Instead of this:

```typescript
// View-specific API call every time you navigate
const { data: projectTodos } = useQuery({
  queryKey: ['project-todos', projectId],
  queryFn: () => fetchProjectTodosWithUsers(projectId)
})
```

You can do this:

```typescript
// Load normalized collections upfront (3 broader calls)
const todoCollection = createQueryCollection({
  queryKey: ['todos'],
  queryFn: fetchAllTodos,
})
const userCollection = createQueryCollection({
  queryKey: ['users'],
  queryFn: fetchAllUsers,
})
const projectCollection = createQueryCollection({
  queryKey: ['projects'],
  queryFn: fetchAllProjects,
})

// Navigation is instant — no new API calls needed
const { data: activeProjectTodos } = useLiveQuery(
  (q) =>
    q
      .from({ t: todoCollection })
      .innerJoin(
        { u: userCollection },
        ({ t, u }) => eq(t.userId, u.id)
      )
      .innerJoin(
        { p: projectCollection },
        ({ u, p }) => eq(u.projectId, p.id)
      )
      .where(({ t }) => eq(t.active, true))
      .where(({ p }) =>
        eq(p.id, currentProject.id)
      )
)
```

Now, clicking between projects, users, or views requires **zero API calls**. All the data is already loaded. New features like **"show user workload across all projects"** work instantly without touching your backend.

Your API becomes simpler. Your network calls drop dramatically. Your frontend gets faster as your dataset grows.

## The 20MB Question

**Your app would be dramatically faster if you just loaded 20MB of normalized data upfront** instead of making hundreds of small API calls.

Companies like Linear, Figma, and Slack load massive datasets into the client and achieve incredible performance through heavy investment in custom indexing, differential updates, and optimized rendering. These solutions are too complex and expensive for most teams to build.

**TanStack DB brings this capability to everyone** through differential dataflow — a technique that only recomputes the parts of queries that actually changed. Instead of choosing between "many fast API calls with network waterfalls" or "few API calls with slow client processing," you get the best of both options: fewer network round-trips AND sub-millisecond client-side queries, even with large datasets.

This isn't just about sync engines like [Electric (though they make this pattern incredibly powerful)](https://electric-sql.com/blog/2025/07/29/local-first-sync-with-tanstack-db). It's about enabling a fundamentally different data loading strategy that works with any backend — REST, GraphQL, or real-time sync.

## Why are sync engines interesting?

While TanStack DB works great with REST and GraphQL, it really shines when paired with sync engines. Here's why sync engines are such a powerful complement:

**Easy real-time** — If you need real-time updates, you know how painful it can be to set up WebSockets, handle reconnections, and wire up event handlers. Many new sync engines are native to your actual data store (e.g., Postgres) so you can simply write to the database directly and know the update will get streamed out to all subscribers in real-time. No more manual WebSocket plumbing.

**Side-effects are pushed automatically** — When you do a backend mutation, there are often cascading updates across multiple tables. Update a todo's status? That might change the project's completion percentage, update team metrics, or trigger workflow automations. With TanStack Query alone, you need manual bookkeeping to track all these potential side-effects and reload the right data. Sync engines eliminate this complexity—any backend change that happens during a mutation is automatically pushed to all clients - without any extra work.

**Load far more data efficiently** — It's far cheaper to update data in the client when using sync engines. Instead of re-loading entire collections after each change, sync engines send only the actual changed items. This makes it practical to load far more data upfront, enabling the "load everything once" pattern that makes apps like Linear feel so fast.

TanStack DB was designed from the ground up to support sync engines. [When you define a collection, you're provided with an API for writing synced transactions](https://tanstack.com/db/latest/docs/collection-options-creator) from the backend into your local collections. Try out collection implementations for [Electric](https://tanstack.com/db/latest/docs/installation#electric-collection), [Trailblaze](https://tanstack.com/db/latest/docs/installation#trailbase-collection), and [(soon) Firebase](https://github.com/TanStack/db/pull/323)!

DB gives you a common interface for your components to query data, which means you can easily switch between data loading strategies as needed without changing client code. Start with REST, switch to a sync engine later as needed—your components don't need to know the difference.

## Our Goals for TanStack DB

We're building TanStack DB to address the client-side data bottlenecks that every team eventually hits. Here's what we're aiming for:

- **True backend flexibility**: Work with any data source through pluggable collection creators. Whether you're using REST APIs, GraphQL, Electric, Firebase, or building something custom, TanStack DB adapts to your stack. Start with what you have, upgrade if needed, mix different approaches in the same app.
- **Incremental adoption that actually works**: Start with one collection, add more as you build new features. No big-bang migrations or development pauses.
- **Query performance at scale**: Sub-millisecond queries across large datasets through differential dataflow, even when your app has thousands of items.
- **Optimistic updates that don't break**: Reliable rollback behavior when network requests fail, without complex custom state management.
- **Type and runtime safety throughout**: Full TypeScript inference from your schema to your components, catching data mismatches at compile and runtime.

We're excited about giving teams a fundamentally better way to handle client-side data—while preserving the freedom to choose whatever backend works best.

## What's Next

TanStack DB 0.1 (first beta) is available now. We're specifically looking for teams who:

- Already use TanStack Query and hit performance/code complexity walls with complex state
- Build collaborative features but struggle with slow optimistic updates
- Have 1000+ item datasets causing rendering performance issues
- Want real-time functionality without rewriting their entire data layer
- First 20 teams get migration office hours

If your team spends more time optimizing React re-renders than building features, or if your collaborative features feel sluggish compared to Linear and Figma, TanStack DB is designed for exactly your situation.

**Get started today:**

- [Documentation & Quick Start](https://tanstack.com/db/latest)
- [Try out the TanStack DB Starter](https://github.com/TanStack/db/tree/main/examples/react/projects)
- [Join the TanStack Discord](https://tlinz.com/discord) - Direct migration support from the team

No more stutters. No more jank. Stop re-rendering—start shipping!
