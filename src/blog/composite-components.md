---
title: 'Composite Components: Server Components with Client-Led Composition'
published: 2026-01-15
draft: true
authors:
  - Manuel Schiller
  - Tanner Linsley
---

![Composite Components](/blog-assets/composite-components/header.jpg)

React Server Components (RSC) are a genuine leap for React. They reduce bundle size, stream UI as it resolves, and move work off the client.

But existing implementations come with a tradeoff: the server owns the component tree. Your client code opts into interactivity with `'use client'`, and composition flows one direction: server decides, client receives.

What if RSCs were actually components that the client could fetch, cache, and compose on its own terms?

That's what we built in **TanStack Start**.

> **Status:** RSC support ships as an experimental feature in TanStack Start RC and will remain experimental into early v1. The API design is stable but expect refinements. See the [Start documentation](https://tanstack.com/start) for setup instructions.

---

## What Are Composite Components?

A **Composite Component** is a server-rendered React component that the client can fetch, cache, and assemble into its own UI tree.

The server ships UI _pieces_. The client decides how to arrange them.

This inverts the typical RSC model. Instead of the client hydrating a server-owned tree, the client pulls server-rendered fragments and composes them using familiar React patterns: props, children, render props. No `'use client'` directives needed: your client components are already client components. You pass them into slots, and they render with full interactivity.

Why this matters in practice:

- Cache RSC output across navigations
- Interleave server UI with client state
- Reuse the same server fragments in multiple layouts

Composite Components integrate with the tools you already use:

- **TanStack Router** loads them in route loaders and caches them automatically
- **TanStack Query** caches them with fine-grained control over staleness and refetching
- **TanStack DB** (coming soon) will sync them with offline support and optimistic updates

The wire format is standard React Flight. The mental model is: server components are data.

---

## Why RSCs Matter

Before diving into the patterns, here's when server components help:

- **Heavy dependencies stay on the server.** Markdown parsers, syntax highlighters, and date formatting libraries can add hundreds of KB to your bundle. With RSCs, that code runs on the server and only the rendered output ships to the client.

- **Colocated data fetching.** TanStack Router already eliminates waterfalls by parallelizing route loaders. RSCs offer a different ergonomic: Await data directly in the component that renders it. This can be convenient for static or slow-changing content.

- **Sensitive logic stays secure.** API keys, database queries, business logic: none of it reaches the client bundle.

- **Streaming for perceived performance.** RSCs stream UI progressively. Users see content immediately while slower parts load in the background.

RSCs aren't about replacing client interactivity. They're about choosing where work happens.

---

## Composition Patterns

Composite Components support two levels of composition.

### Intra-component: Slots Inside One Component

A Composite Component can render server UI while exposing **slots** for client content. Slots use plain React patterns:

- `children`
- render props (like `renderActions`)

Because the client owns the component tree, the components you pass into slots are regular client components. No `'use client'` directive required. The server positions them as opaque placeholders but can't inspect, clone, or transform them. That's what keeps the model predictable.

#### Server

```tsx
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

        {/* Server renders this link directly */}
        <Link to="/posts/$postId" params={{ postId: post.nextPostId }}>
          Next Post
        </Link>

        {/* Slot: server requests client UI here */}
        <footer>
          {props.renderActions?.({ postId: post.id, authorId: post.authorId })}
        </footer>

        {/* Slot: client fills this with children */}
        {props.children}
      </article>
    ),
  )
})
```

#### Client

```tsx
function PostPage({ postId }) {
  const { data: Post } = useSuspenseQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost({ data: { postId } }),
  })

  return (
    <Post
      renderActions={({ postId, authorId }) => (
        // Full client interactivity: hooks, state, context
        <PostActions postId={postId} authorId={authorId} />
      )}
    >
      <Comments postId={postId} />
    </Post>
  )
}
```

The server renders the `<Link>` directly and leaves join points for the client:

- A render prop slot for `<PostActions>` (with server-provided arguments)
- A `children` slot for `<Comments>`

### Inter-component: Composition Across Components

Since a Composite Component is just data, the client can treat it as a building block:

- Interleave multiple Composite Components in a new tree
- Wrap them in client providers or layouts
- Nest one inside another via slots
- Reorder or swap them based on client state

Same mental model as regular React components.

### Bundling Multiple RSCs

Sometimes you want to fetch a few server-rendered fragments together, like a header, a content region, and a footer. A single server function can return multiple Composite Components in one request:

```tsx
const getPageLayout = createServerFn().handler(async () => {
  const [Header, Content, Footer] = await Promise.all([
    createServerComponent(<header>...</header>),
    createServerComponent(<main>...</main>),
    createServerComponent(<footer>...</footer>),
  ])

  return { Header, Content, Footer }
})
```

This keeps network overhead low while still giving you composable pieces. Each returned component can still expose its own slots.

---

## Caching

Server components are streams. TanStack Start integrates them with two caching layers.

### Router: Automatic Route-Based Caching

TanStack Router caches loader data automatically. The cache key is the route path plus its params:

```tsx
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

Navigate from `/posts/abc` to `/posts/xyz` and the loader runs again. Navigate back to `/posts/abc` and Router serves the cached component instantly.

For dependencies beyond route params, use `loaderDeps`:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loaderDeps: ({ search }) => ({
    tab: search.tab,
    sort: search.sort,
  }),
  loader: async ({ params, deps }) => ({
    Post: await getPost({
      data: {
        postId: params.postId,
        tab: deps.tab,
        sort: deps.sort,
      },
    }),
  }),
  component: PostPage,
})
```

Now the cache key includes search params. Updating the `tab` search param will cause the component to be refetched. Change back and you get a cache hit.

Router caching is effectively zero-config for most routes. No manual cache keys, no query configuration.

### Query: Fine-Grained Control

When you need more control, use TanStack Query. With Suspense you can treat the server component like any other async resource. You still get explicit cache keys, stale time, background refetching, and all the other Query features:

```tsx
function PostPage() {
  const { postId } = Route.useParams()

  const { data: Post } = useSuspenseQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost({ data: { postId } }),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Post renderActions={({ postId }) => <PostActions postId={postId} />}>
      <Comments postId={postId} />
    </Post>
  )
}
```

Navigate away and back: cache hit, instant render, no network request. The RSC payload is the cache value. Query doesn't know it's caching a server component. It's just bytes that decode into a React element tree.

For static content, cache aggressively. This typically pairs well with a Suspense boundary at a layout level:

```tsx
const { data: Layout } = useSuspenseQuery({
  queryKey: ['layout'],
  queryFn: () => getLayout(),
  staleTime: Infinity,
})
```

---

## How It Works

When your server component accesses props, it accesses a proxy. Every property access and function call is tracked:

- `props.children` serializes as a slot placeholder
- `props.renderActions({ postId, authorId })` serializes with the arguments attached

You can destructure props normally. The proxy handles both `props.children` and `({ children })`.

**Rules:** Slot placeholders are opaque on the server. You can't enumerate props with `Object.keys()` or serialize a render prop with `JSON.stringify()`. The [documentation](/start/latest/docs/server-components) covers the full contract.

Over the wire, it's a React element stream with embedded placeholders. On the client:

1. The stream decodes into a React element tree
2. Placeholders match the props you passed when rendering
3. Render functions replay with the serialized arguments

```
Server                              Client
------                              ------
props.renderActions({               renderActions prop is called
  postId: "abc",             ->     with { postId: "abc", authorId: "xyz" }
  authorId: "xyz"
})                                  Your function runs client-side
                                    with full hooks/state/context
```

Type safety flows through when client and server share types. The function signature on the server determines what arguments your client function receives.

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
    <article>
      {/* ... */}
      <footer>
        {props.renderActions?.({ postId: post.id, authorId: post.authorId })}
      </footer>
    </article>
  ))
})

function PostPage({ postId }) {
  return (
    <Post
      renderActions={(args: PostActionsArgs) => (
        <PostActions postId={args.postId} authorId={args.authorId} />
      )}
    />
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

## Current Status: Experimental

RSC support is experimental in TanStack Start RC and will remain experimental into early v1.

**Serialization:** This release uses React's native Flight protocol. TanStack Start's usual serialization features aren't available within server components for now.

**API surface:** The `createServerComponent` API and slot patterns are stable in design but may see refinements.

If you hit rough edges, [open an issue](https://github.com/tanstack/router/issues) or join the [Discord](https://tlinz.com/discord).

---

## FAQ

### How does this compare to Next.js App Router?

Next.js App Router is server-first: your component tree lives on the server by default, and you opt into client interactivity with `'use client'`.

TanStack Start is **isomorphic-first**: your tree lives wherever makes sense. The key difference is **client-led composition**. Composite Components expose slots so the client assembles the final tree.

### Can I use this with Next.js or Remix?

Not directly. TanStack Start is its own framework. But if you use TanStack Query or Router, the mental model transfers.

### Do I have to use RSCs?

No. RSCs are opt-in. You can build fully client-side routes (including `ssr: false`), use traditional SSR without server components, or go fully static.

Composite Components are just another primitive. They compose with Start features like Selective SSR and with TanStack Query and Router caching, instead of replacing them.

### What about React 19 and Server Actions?

TanStack Start uses React's Flight protocol and works with React 19. `createServerFn` serves a similar purpose to Server Actions but integrates with TanStack's middleware, validation, and caching. We're watching the Server Actions API and will align where it makes sense.

### Can I define components outside `createServerComponent`?

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

### Can I return raw JSX without `createServerComponent`?

Not currently. `createServerComponent` enables streaming, slot handling, and client rehydration. Plain JSX from a server function won't have RSC behavior.

### Do `cloneElement` and React Context work with server component children?

**cloneElement:** No. Client children are slot placeholders. The server can't inspect or clone them.

**React Context:** Yes. Providers in server components wrap client children. The context must work across the boundary (typically `'use client'` on the provider component).

### Security considerations?

TanStack Start doesn't send Flight data to the server or parse it there. Payloads flow one direction: server to client.

TanStack Start doesn't support React Server Functions (the `'use server'` directive). Recent security advisories target vulnerabilities in parsing untrusted Flight data on the server, which doesn't apply here.

That said, treat your server functions like any API surface: authenticate requests, validate inputs, and keep React patched.

---

## Get Started

TanStack Start's RSC model is available now as an experimental feature.

- [Documentation](https://tanstack.com/start)
- [GitHub](https://github.com/tanstack/router)
- [Discord](https://tlinz.com/discord)
