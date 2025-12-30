---
title: What If RSCs Were Actually Components?
published: 2025-01-15
authors:
  - Tanner Linsley
  - Manuel Schiller
---

React Server Components are a genuine leap for React. They reduce bundle size, stream UI as it resolves, and move work off the client.

But the current model comes with a tradeoff: **the server owns the component tree**.  
Your client code opts into interactivity with `'use client'`. **Composition flows one direction**—server decides, client receives. The React model you know—props, context, bidirectional composition—gets fragmented across environments.

What if it didn't have to?

What if RSCs were actually components? **Fetchable. Cacheable. Composable in both directions.** Primitives that flow through your router, your cache, your data layer—without special directives or framework lock-in.

That's what we built in **TanStack Start**.

---

## The One-Way Problem

In the traditional RSC model, the server is the only place that decides what interactive elements to render.

Need a `<Link>` with prefetching? **Server** renders it with `'use client'`.  
Need a dashboard widget? Server renders the boundary, marks it client. **The server is always the decision-maker. The client is always the recipient.**

This works. **But it's also limiting.**

What if the server wants to render some interactive elements directly (like `<Link>`) but also **defer entire regions of interactivity back to the client**?  
In the traditional model, you'd create a new client component, a new file, a new boundary. **Every deferral is a seam.**

---

## Bidirectional Composition

**TanStack Start flips the constraint.**

**Server components can render interactive elements directly**—`<Link>`, `<Button>`, anything marked `'use client'`. That part works the same.

But they can also **declare slots**—regions where the client decides what to render. Not by creating new components or files, but through plain props: children, render functions, whatever pattern you already use.

```tsx
// Server
const getPost = createServerFn().handler(async ({ data }) => {
  const post = await db.posts.get(data.postId)

  return createServerComponent(
    // Props can include any render functions—"renderActions" is just a name,
    // not a special API. Use whatever prop names make sense for your component.
    (props: {
      children?: React.ReactNode
      renderActions?: (data: {
        postId: string
        authorId: string
      }) => React.ReactNode
    }) => (
      <article>
        <h1>{post.title}</h1>
        <p>{post.body}</p>

        {/* Server renders this directly—it's interactive via 'use client' */}
        <Link to="/posts/$postId" params={{ postId: post.nextPostId }}>
          Next Post
        </Link>

        {/* Server defers this to the client */}
        <footer>
          {props.renderActions?.({ postId: post.id, authorId: post.authorId })}
        </footer>

        {/* Client decides what goes here */}
        {props.children}
      </article>
    ),
  )
})
```

```tsx
// Client
function PostPage({ postId }) {
  const { data: Post } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost({ data: { postId } }),
  })

  if (!Post) return <PostSkeleton />

  return (
    <Post
      renderActions={({ postId, authorId }) => (
        // Full client interactivity—hooks, state, context, all of it
        <PostActions postId={postId} authorId={authorId} />
      )}
    >
      <Comments postId={postId} />
    </Post>
  )
}
```

**The server rendered the `<Link>` directly.** It also passed `postId` and `authorId` through the slot so the client could render `<PostActions>` with that data. And it left children open for the client to fill with `<Comments>`.

**Both directions. Same component. No new files. No new boundaries.**  
That's inversion of control.

---

## RSCs as a Primitive

Here's the shift: in TanStack Start, **server components aren't a paradigm**. They're a _primitive_—a serialization format that flows through your existing architecture.

When `createServerFn` returns a server component, that component is a **stream**. Streams are universal. They work with:

- **TanStack Router** → Load server components in route loaders, stream them during navigation
- **TanStack Query** → Cache server components, refetch in the background, deduplicate requests
- **TanStack DB** (coming soon) → Sync server component state, offline support, optimistic updates

```tsx
// In a route loader
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => ({
    Post: await getPost({ data: { postId: params.postId } }),
  }),
  component: PostPage,
})

function PostPage() {
  const { Post } = Route.useLoaderData()

  return (
    <Post renderActions={({ postId }) => <PostActions postId={postId} />}>
      <Comments />
    </Post>
  )
}
```

```tsx
// With Query caching
const { data: Layout } = useQuery({
  queryKey: ['layout'],
  queryFn: () => getLayout(),
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
})
```

**The server component is just data.** Fetch it, cache it, transform it, compose it. **No special APIs. No framework-specific caching layers.** Just streams flowing through tools you already know.

---

## How It Works

When `createServerComponent` runs, two things happen:

1. **Your component renders to a stream.** The `<article>`, `<h1>`, `<p>`, and `<Link>` elements serialize immediately and begin streaming to the client. The client can start rendering these before the full response arrives.

2. **Props become a proxy.** Every property access and function call is tracked and serialized as a placeholder:
   - `props.children` → serialized as a slot placeholder
   - `props.renderActions({ postId, authorId })` → serialized with the arguments attached

**Over the wire, it's a React element stream** with embedded placeholders. On the client:

1. The stream decodes into a React element tree
2. Placeholders match the props you passed when rendering
3. Render functions replay with the serialized arguments

```
Server                              Client
───────                             ──────
props.renderActions({               renderActions prop is called
  postId: "abc",             →      with { postId: "abc", authorId: "xyz" }
  authorId: "xyz"
})                                  Your function runs client-side
                                    with full hooks/state/context
```

**Type safety flows through automatically.** The function signature on the server determines what arguments your client function receives:

```tsx
const getPost = createServerFn().handler(async ({ data }) => {
  const post = await db.posts.get(data.postId)

  return createServerComponent(
    (props: {
      renderActions?: (data: {
        postId: string
        authorId: string
      }) => React.ReactNode
    }) => {
      // TypeScript knows exactly what props.renderActions receives
      props.renderActions?.({ postId: post.id, authorId: post.authorId })
      // ...
    },
  )
})
```

---

## The Full Spectrum

With RSCs as primitives, TanStack Start covers every frontend use case:

- **Fully Interactive**  
  No server components at all. Client-first, SPA-style. RSCs are an optimization you add when helpful, not a paradigm you build around.

- **Hybrid**  
  Server components for static shells, data-heavy regions, or SEO-critical content. Slots for interactivity. Mix freely within the same component.

- **Fully Static**  
  Pre-render everything at build time. No hydration, no JavaScript. Ship HTML.

**One framework. One mental model. The entire spectrum.**  
You don't choose "interactive framework" or "static framework" or "RSC framework."  
You choose patterns **per-route, per-component, per-use-case**. The architecture supports all of it.

---

## The Philosophy

React Server Components are powerful. They unlock patterns that weren't possible before.

But the traditional model makes a choice: **the server owns the tree, and interactivity is an escape hatch.** That works for content-heavy sites. It creates friction for apps that are fundamentally interactive.

**TanStack Start doesn't make that choice for you.**

> RSCs are a serialization format—a way to stream React elements from the server. They're a primitive, not a paradigm. Use them when they help. Compose around them when you need control. The client and server are peers, not a hierarchy.

The server can render interactive elements directly. It can also defer to the client through slots. **Composition flows both directions.**  
You decide the balance, per-component, based on what makes sense.

Because it's not about client or server.  
**It's about using both—intentionally.**

---

## Current Status: Experimental

This is the first experimental release of RSCs in TanStack Start. A few things to know:

**React's Flight serializer** — This release uses React's native RSC Flight protocol for serialization. That means TanStack Start's usual Seroval-based serialization isn't available within server components for now. Standard JavaScript primitives, Dates, and React elements serialize fine. Custom Seroval plugins and extended types will come in a future release as we unify the serialization layers.

**API surface** — The `createServerComponent` API and slot patterns shown here are stable in design but may see refinements based on feedback. We're shipping early to learn from real usage.

**Performance** — Streaming works today. We're continuing to optimize the ReplayableStream buffering, frame protocol efficiency, and cache integration.

If you hit rough edges, [open an issue](https://github.com/tanstack/router/issues) or drop into [Discord](https://tlinz.com/discord). This is the time to shape the API.

---

## FAQ

### How does this compare to Next.js App Router?

Next.js App Router is server-first: your component tree lives on the server by default, and you opt into client interactivity with `'use client'` boundaries.

TanStack Start is **isomorphic-first**: your tree lives wherever makes sense, and RSCs are a primitive you pull in when helpful.

**The key architectural difference is bidirectional composition.** In the traditional model, server components can render client components, but not the reverse—client components can't meaningfully "call into" server components at render time. TanStack Start's slot pattern enables this: the server declares _where_ client content goes and _what data it receives_, while the client decides _what_ to render there.

**What's hard or impossible in other implementations:**

- **Client-driven composition** — In Next.js, if a client component needs server data, you typically fetch it separately or lift state up. With slots, the server component passes exactly what the client needs through render function arguments.
- **Caching RSCs like data** — Traditional RSCs are tied to route boundaries. TanStack Start treats them as values that flow through Query's cache—refetch, invalidate, deduplicate, all the patterns you know.
- **Incremental adoption** — Most RSC frameworks require restructuring your app around server-first rendering. TanStack Start lets you add RSCs to specific components without changing your architecture.

### Can I use this with my existing Next.js/Remix app?

Not directly—TanStack Start is its own framework built on TanStack Router. But if you're using TanStack Query or TanStack Router already, the mental model transfers. Server components become another data source that Query can cache and Router can load.

### Do I have to use RSCs?

No. RSCs are entirely opt-in. You can build fully client-side SPAs with TanStack Start, use traditional SSR without server components, or go fully static. RSCs are one tool in the spectrum, not a requirement.

### What about React 19 / `use` / Server Actions?

TanStack Start's RSC implementation builds on React's Flight protocol and works with React 19. Server Actions are a separate primitive—`createServerFn` serves a similar purpose but integrates with TanStack's middleware, validation, and caching model. We're watching the Server Actions API and will align where it makes sense.

### When will Seroval serialization work inside RSCs?

It's on the roadmap. The current release uses React's Flight serializer directly, which handles the core use cases. Unifying with Seroval for custom types, extended serialization, and tighter TanStack DB integration is planned for a future release.

### Can I use React context or `cloneElement` to pass props to slots?

No. The server and client are separate environments connected by serialization. React context doesn't cross that boundary—a context provider on the server won't be visible to client components rendered in slots. Similarly, `cloneElement` won't work because the server component has already serialized by the time the client renders.

**Use explicit props instead.** The render function pattern (`renderActions={({ postId }) => ...}`) is the intended way to pass data from server to client slots. It's explicit, type-safe, and works across the serialization boundary.

### Do I have to define the component inside `createServerFn`?

Yes, for now. The component function passed to `createServerComponent` needs access to server-side data (like `post` in our examples), and that data comes from the handler's closure. Defining the component inline keeps this straightforward.

```tsx
// This works—component closes over `post`
const getPost = createServerFn().handler(async ({ data }) => {
  const post = await db.posts.get(data.postId)
  return createServerComponent((props) => <article>{post.title}</article>)
})
```

### Is `createServerComponent` like `memo`? Can I wrap any component?

No. `createServerComponent` isn't a wrapper—it's a factory that creates a serializable server component. You pass it a component function that will be rendered on the server and streamed to the client.

Unlike `memo`, you can't wrap an existing component. The function you pass must be defined inline (or at least have access to the server data it needs through closure).

### Can I return plain JSX from `createServerFn` without `createServerComponent`?

If you don't need the client to pass props back, you can return a pre-rendered element. But you lose the slot pattern—there's no way for the client to inject children or render functions.

```tsx
// This works but has no slots
const getStaticContent = createServerFn().handler(async () => {
  const content = await getMarkdown()
  return <article dangerouslySetInnerHTML={{ __html: content }} />
})
```

For content that's truly static and needs no client composition, this is fine. For anything interactive, use `createServerComponent`.

### Can I destructure props in my server component?

No. Since `props` is a Proxy that tracks access, destructuring breaks the tracking:

```tsx
// ❌ Won't work—destructuring loses the proxy
createServerComponent(({ children, renderActions }) => {
  // children and renderActions are undefined or broken
})

// ✅ Works—access through the proxy
createServerComponent((props) => {
  // props.children and props.renderActions are tracked correctly
})
```

Always access props through `props.propertyName`.

### What are good use cases for reducing bundle size?

Server components shine when you have heavy dependencies that don't need to run on the client:

- **Markdown/MDX processing** — Libraries like `marked`, `remark`, or syntax highlighters can stay server-only
- **Date formatting** — Large locale data from libraries like `date-fns` or `luxon`
- **Data transformation** — Heavy processing, validation, or sanitization logic
- **Database clients** — ORMs and query builders never ship to the browser

The key insight: anything imported only inside a server component stays out of the client bundle entirely.

---

## Get Started

TanStack Start's RSC model is available now in experimental.

- [Documentation](https://tanstack.com/start)
- [GitHub](https://github.com/tanstack/router)
- [Discord](https://tlinz.com/discord)
