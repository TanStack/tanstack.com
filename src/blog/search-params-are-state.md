---
title: Search Params Are State
published: 2025-06-03
authors:
  - Tanner Linsley
---

![Search Params Are State Header](/blog-assets/search-params-are-state/search-params-are-state-header.jpg)

## Search Params Are State — Treat Them That Way

Search params have been historically treated like second-class state. They're global, serializable, and shareable — but in most apps, they’re still hacked together with string parsing, loose conventions, and brittle utils.

Even something simple, like validating a `sort` param, quickly turns verbose:

```ts
const schema = z.object({
  sort: z.enum(['asc', 'desc']),
})

const raw = Object.fromEntries(new URLSearchParams(location.href))
const result = schema.safeParse(raw)

if (!result.success) {
  // fallback, redirect, or show error
}
```

This works, but it’s manual and repetitive. There’s no inference, no connection to the route itself, and it falls apart the moment you want to add more types, defaults, transformations, or structure.

Even worse, `URLSearchParams` is string-only. It doesn’t support nested JSON, arrays (beyond naive comma-splitting), or type coercion. So unless your state is flat and simple, you’re going to hit walls fast.

That’s why we’re starting to see a rise in tools and proposals — things like Nuqs, Next.js RFCs, and userland patterns — aimed at making search params more type-safe and ergonomic. Most of these focus on improving _reading_ from the URL.

But almost none of them solve the deeper, harder problem: **writing** search params, safely and atomically, with full awareness of routing context.

---

### Writing Search Params Is Where It Falls Apart

It’s one thing to read from the URL. It’s another to construct a valid, intentional URL from code.

The moment you try to do this:

```tsx
<Link to="/dashboards/overview" search={{ sort: 'asc' }} />
```

You realize you have no idea what search params are valid for this route, or if you’re formatting them correctly. Even with a helper to stringify them, nothing is enforcing contracts between the caller and the route. There’s no type inference, no validation, and no guardrails.

This is where **constraint becomes a feature**.

Without explicitly declaring search param schemas in the route itself, you’re stuck guessing. You might validate in one place, but there’s nothing stopping another component from navigating with invalid, partial, or conflicting state.

Constraint is what makes coordination possible. It’s what allows **non-local callers** to participate safely.

---

### Local Abstractions Can Help — But They Don’t Coordinate

Tools like **Nuqs** are a great example of how local abstractions can improve the _ergonomics_ of search param handling. You get Zod-powered parsing, type inference, even writable APIs — all scoped to a specific component or hook.

They make it easier to read and write search params **in isolation** — and that’s valuable.

But they don’t solve the broader issue of **coordination**. You still end up with duplicated schemas, disjointed expectations, and no way to enforce consistency between routes or components. Defaults can conflict. Types can drift. And when routes evolve, nothing guarantees all the callers update with them.

That’s the real fragmentation problem — and fixing it requires bringing search param schemas into the routing layer itself.

---

### How TanStack Router Solves It

TanStack Router solves this holistically.

Instead of spreading schema logic across your app, you define it **inside the route itself**:

```ts
export const Route = createFileRoute('/dashboards/overview')({
  validateSearch: z.object({
    sort: z.enum(['asc', 'desc']),
    filter: z.string().optional(),
  }),
})
```

This schema becomes the single source of truth. You get full inference, validation, and autocomplete everywhere:

```tsx
<Link
  to="/dashboards/overview"
  search={{ sort: 'asc' }} // fully typed, fully validated
/>
```

Want to update just part of the search state? No problem:

```ts
navigate({
  search: (prev) => ({ ...prev, page: prev.page + 1 }),
})
```

It’s reducer-style, transactional, and integrates directly with the router’s reactivity model. Components only re-render when the specific search param they use changes — not every time the URL mutates.

---

### How TanStack Router Prevents Schema Fragmentation

When your search param logic lives in userland — scattered across hooks, utils, and helpers — it’s only a matter of time before you end up with **conflicting schemas**.

Maybe one component expects \`sort: 'asc' | 'desc'\`. Another adds a \`filter\`. A third assumes \`sort: 'desc'\` by default. None of them share a source of truth.

This leads to:

- Inconsistent defaults
- Colliding formats
- Navigation that sets values others can’t parse
- Broken deep linking and bugs you can’t trace

TanStack Router prevents this by tying schemas directly to your route definitions — **hierarchically**.

Parent routes can define shared search param validation. Child routes inherit that context, add to it, or extend it in type-safe ways. This makes it _impossible_ to accidentally create overlapping, incompatible schemas in different parts of your app.

---

### Example: Safe Hierarchical Search Param Validation

Here’s how this works in practice:

```ts
// routes/dashboard.tsx
export const Route = createFileRoute('/dashboard')({
  validateSearch: z.object({
    sort: z.enum(['asc', 'desc']).default('asc'),
  }),
})
```

Then a child route can extend the schema safely:

```ts
// routes/dashboard/$dashboardId.tsx
export const Route = createFileRoute('/dashboard/$dashboardId')({
  validateSearch: z.object({
    filter: z.string().optional(),
    // ✅ \`sort\` is inherited automatically from the parent
  }),
})
```

When you match \`/dashboard/123?sort=desc&filter=active\`, the parent validates \`sort\`, the child validates \`filter\`, and everything works together seamlessly.

Try to redefine the required parent param in the child route to something entirely different? Type error.

```ts
validateSearch: z.object({
  // ❌ Type error: boolean does not extend 'asc' | 'desc' from parent
  sort: z.boolean(),
  filter: z.string().optional(),
})
```

This kind of enforcement makes nested routes composable _and_ safe — a rare combo.

---

### Built-In Discipline

The magic here is that you don’t need to teach your team to follow conventions. The route _owns_ the schema. Everyone just uses it. There’s no duplication. No drift. No silent bugs. No guessing.

When you bring validation, typing, and ownership into the router itself, you stop treating URLs like strings and start treating them like real state — because that’s what they are.

---

### Search Params Are State

Most routing systems treat search params like an afterthought. Something you _can_ read, maybe parse, maybe stringify, but rarely something you can actually **trust**.

TanStack Router flips that on its head. It makes search params a core part of the routing contract — validated, inferable, writable, and reactive.

Because if you’re not treating search params like state, you’re going to keep leaking it, breaking it, and working around it.

Better to treat it right from the start.

If you're intrigued by the possibilities of treating search params as first-class state, we invite you to try out [TanStack Router](https://tanstack.com/router). Experience the power of validated, inferable, and reactive search params in your routing logic.
