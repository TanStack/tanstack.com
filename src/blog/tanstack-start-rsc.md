---
title: What If RSCs Were Actually Components?
published: 2025-01-15
authors:
  - Tanner Linsley
  - Manuel Schiller
---

![What If RSCs Were Actually Components?](/blog-assets/tanstack-start-rsc/header.jpg)

React Server Components are a genuine leap for React. They reduce bundle size, stream UI as it resolves, and move work off the client.

But the way RSCs have been implemented so far comes with a tradeoff: **the server owns the component tree**.  
Your client code opts into interactivity with `'use client'`. **Composition flows one direction**: server decides, client receives. The React model you know (props, context, bidirectional composition) gets fragmented across environments.

What if it didn't have to?

What if RSCs were actually components? **Fetchable. Cacheable. Composable in both directions.** Primitives that flow through your router, your cache, your data layer, without special directives or framework lock-in.

That's what we built in **TanStack Start**.

---

## Why RSCs Matter

Before diving into the model, it's worth understanding when server components shine:

- **Heavy dependencies stay on the server.** Markdown parsers, syntax highlighters, date formatting libraries can add hundreds of KB to your bundle. With RSCs, that code runs on the server and only the rendered output ships to the client.

- **Colocated data fetching.** TanStack Router already eliminates waterfalls by parallelizing route loaders. RSCs offer a different ergonomic: awaiting data directly in the component that renders it, which can be convenient for static or slow-changing content.

- **Sensitive logic stays secure.** API keys, database queries, business logic: none of it reaches the client bundle.

- **Streaming for perceived performance.** Instead of waiting for all data before showing anything, RSCs stream UI progressively. Users see content immediately while slower parts load in the background.

RSCs aren't about replacing client interactivity. They're about choosing where work happens. **The question is: who controls that choice?**

---

## The One-Way Problem

In existing RSC implementations, the server is the only place that decides what interactive elements to render.

Need a `<Link>` with prefetching? **Server** renders it with `'use client'`.  
Need a dashboard widget? Server renders the boundary, marks it client. **The server is always the decision-maker. The client is always the recipient.**

This works. **But it's also limiting.**

What if the server wants to render some interactive elements directly (like `<Link>`) but also **defer entire regions of interactivity back to the client**?  
In the traditional model, you'd create a new client component, a new file, a new boundary. **Every deferral is a seam.**

---

## Bidirectional Composition

**TanStack Start flips the constraint.**

**Server components can render interactive elements directly**: `<Link>`, `<Button>`, anything marked `'use client'`. That part works the same.

But they can also **declare slots**, regions where the client decides what to render. Not by creating new components or files, but through plain props: children, render functions, whatever pattern you already use. These aren't special APIs. `renderActions` in the example below is just a prop name we chose. You can name your render props anything you want.

```tsx
// Server
const getPost = createServerFn().handler(async ({ data }) => {
  const post = await db.posts.get(data.postId)

  return createServerComponent(
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

        {/* Server renders this directly, it's interactive via 'use client' */}
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
        // Full client interactivity: hooks, state, context, all of it
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

Here's the shift: in TanStack Start, **server components aren't a paradigm**. They're a _primitive_, a serialization format that flows through your existing architecture.

When `createServerFn` returns a server component, that component is a **stream**. This means you don't have to wait for the entire component to finish rendering before sending HTML to the client. Parts of the UI can render immediately while slower async work (database queries, API calls) resolves in the background. The client sees a Suspense fallback, then the final content streams in when ready. No full page reload, no blocking.

This works for SSR (streaming HTML during initial page load) and for client-side fetches (streaming RSC payloads during navigation or data refetches).

Streams are universal. They work with:

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

When your server component accesses props, it's accessing a **proxy**.  
Every property access and function call is tracked:

- `props.children` → serialized as a slot placeholder
- `props.renderActions({ postId, authorId })` → serialized with the arguments attached

You can destructure props normally. `({ children, renderActions })` works just as well as `props.children`. The proxy handles both patterns.

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

> RSCs are a serialization format, a way to stream React elements from the server. They're a primitive, not a paradigm. Use them when they help. Compose around them when you need control. The client and server are peers, not a hierarchy.

The server can render interactive elements directly. It can also defer to the client through slots. **Composition flows both directions.**  
You decide the balance, per-component, based on what makes sense.

Because it's not about client or server.  
**It's about using both, intentionally.**

---

## Current Status: Experimental

This is the first experimental release of RSCs in TanStack Start. A few things to know:

**React's Flight serializer**: This release uses React's native RSC Flight protocol for serialization. That means TanStack Start's usual serialization features aren't available within server components for now. Standard JavaScript primitives, Dates, and React elements serialize fine. Custom serialization plugins and extended types will come in a future release as we unify the serialization layers.

**API surface**: The `createServerComponent` API and slot patterns shown here are stable in design but may see refinements based on feedback. We're shipping early to learn from real usage.

**Performance**: Streaming works today. We're continuing to optimize the ReplayableStream buffering, frame protocol efficiency, and cache integration.

If you hit rough edges, [open an issue](https://github.com/tanstack/router/issues) or drop into [Discord](https://tlinz.com/discord). This is the time to shape the API.

---

## FAQ

### How does this compare to Next.js App Router?

Next.js App Router is server-first: your component tree lives on the server by default, and you opt into client interactivity with `'use client'` boundaries.

TanStack Start is **isomorphic-first**: your tree lives wherever makes sense, and RSCs are a primitive you pull in when helpful. The key difference is **bidirectional composition**: server components can defer to the client through slots, not just the other way around.

Both approaches support RSCs. They differ in who owns the tree by default and how composition flows.

### Can I use this with my existing Next.js/Remix app?

Not directly. TanStack Start is its own framework built on TanStack Router. But if you're using TanStack Query or TanStack Router already, the mental model transfers. Server components become another data source that Query can cache and Router can load.

### Do I have to use RSCs?

No. RSCs are entirely opt-in. You can build fully client-side SPAs with TanStack Start, use traditional SSR without server components, or go fully static. RSCs are one tool in the spectrum, not a requirement.

### What about React 19 / `use` / Server Actions?

TanStack Start's RSC implementation builds on React's Flight protocol and works with React 19. Server Actions are a separate primitive. `createServerFn` serves a similar purpose but integrates with TanStack's middleware, validation, and caching model. We're watching the Server Actions API and will align where it makes sense.

### When will TanStack Start's full serialization work inside RSCs?

It's on the roadmap. The current release uses React's Flight serializer directly, which handles the core use cases. Unifying with TanStack Start's serializer for custom types, extended serialization, and tighter TanStack DB integration is planned for a future release.

### Can I define my component outside of `createServerComponent`?

Yes. `createServerComponent` initiates the RSC stream generation, but your component can be defined separately and invoked inside:

```tsx
function PostArticle({ post, children, renderActions }) {
  return (
    <article>
      <h1>{post.title}</h1>
      {renderActions?.({ postId: post.id })}
      {children}
    </article>
  )
}

const getPost = createServerFn().handler(async ({ data }) => {
  const post = await db.posts.get(data.postId)
  return createServerComponent((props) => (
    <PostArticle post={post} {...props} />
  ))
})
```

### Can I return raw JSX instead of using `createServerComponent`?

Not currently. Server functions that return UI must wrap it in `createServerComponent`. This is what enables the streaming, slot handling, and client rehydration. Plain JSX returned from a server function won't have the RSC serialization behavior.

### Do `cloneElement` and React Context work with server component children?

**`cloneElement`**: This won't work as you might expect. When children are passed from client to server, they're serialized as slot placeholders, not actual React elements the server can manipulate. The server can't inspect or clone client-provided children.

**React Context**: Context providers rendered by the server component _will_ wrap client children. If your server component renders `<ThemeProvider value="dark">{children}</ThemeProvider>`, the client children can consume that context. However, the context must be defined in a way that works across the server/client boundary (typically with `'use client'` on the provider component).

---

## Get Started

TanStack Start's RSC model is available now in experimental.

- [Documentation](https://tanstack.com/start)
- [GitHub](https://github.com/tanstack/router)
- [Discord](https://tlinz.com/discord)
