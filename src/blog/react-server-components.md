---
title: 'React Server Components Your Way'
published: 2026-01-15
draft: true
authors:
  - Manuel Schiller
  - Tanner Linsley
  - Jack Herrington
---

![React Server Components](/blog-assets/composite-components/header.jpg)

**You know what's best for your application architecture.** That's always been the TanStack philosophy, and it's exactly how we approached React Server Components.

Here's the thing: RSCs are genuinely exciting. Smaller bundles, streaming UI, moving heavy work off the client. But existing implementations force you into a one-size-fits-all pattern. The server owns your component tree. You opt into interactivity with `'use client'`. Composition flows one direction: server decides, client receives.

We think you deserve more control than that.

What if RSCs were components that _you_ could fetch, cache, and compose on your own terms? What if the client led the composition instead of just hydrating whatever the server handed down?

That's exactly what we built in **TanStack Start**. We call them **Composite Components**, and we're genuinely excited to see what you build with them.

> **Status:** RSC support ships as an experimental feature in TanStack Start RC and will remain experimental into early v1. The API design is stable but expect refinements. See the [Start documentation](https://tanstack.com/start) for setup instructions.

---

## What Are Composite Components?

A **Composite Component** is a server-rendered React component that the client can fetch, cache, and assemble into its own UI tree.

The server ships UI _pieces_. The client decides how to arrange them. That's it. That's the model.

This inverts the typical RSC pattern. Instead of the client hydrating a server-owned tree, _your_ client pulls server-rendered fragments and composes them using familiar React patterns: props, children, render props. No `'use client'` directives littering your codebase. Your client components are already client components. You pass them into slots, and they render with full interactivity.

Why does this matter in practice?

- Cache RSC output across navigations (instant back-button, anyone?)
- Interleave server UI with client state
- Reuse the same server fragments in multiple layouts

And because this is TanStack, Composite Components integrate with the tools you already know and trust:

- **TanStack Router** loads them in route loaders and caches them automatically
- **TanStack Query** caches them with fine-grained control over staleness and refetching
- **TanStack DB** (coming soon) will sync them with offline support and optimistic updates

The wire format is standard React Flight. The mental model is simple: server components are data. You fetch them, you cache them, you render them. Your app, your rules.

---

## Two Approaches, Your Choice

TanStack Start gives you two RSC helpers, and you can use either, both, or neither depending on what your app needs.

**`renderToReadableStream` + `createFromReadableStream`** is the simpler option. The server renders to a Flight stream, and the client decodes it:

```tsx
// Server
import { createServerFn } from '@tanstack/react-start'
import { renderToReadableStream } from '@tanstack/react-start/rsc'

export const getGreeting = createServerFn({ method: 'GET' }).handler(
  async () => {
    return await renderToReadableStream(<h1>Hello from the server</h1>)
  },
)

// Client
import { createFromReadableStream } from '@tanstack/react-start/rsc'

function Greeting() {
  const [content, setContent] = useState<React.ReactNode>(null)

  useEffect(() => {
    getGreeting().then((stream) =>
      createFromReadableStream(stream).then(setContent),
    )
  }, [])

  return <>{content}</>
}
```

**`createCompositeComponent`** is for when you need slots—places where the client can inject its own components with full interactivity:

```tsx
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'

const getCard = createServerFn().handler(async () => {
  const src = await createCompositeComponent(
    (props: { children?: React.ReactNode }) => (
      <div className="card">
        <h2>Server-rendered header</h2>
        {props.children}
      </div>
    ),
  )
  return { src }
})

// In your component:
const { src } = await getCard()
return (
  <CompositeComponent src={src}>
    <InteractiveButton /> {/* Full client interactivity */}
  </CompositeComponent>
)
```

Notice there's no `"use client"` anywhere. Components you pass into slots are fully interactive by default—no directives required.

**Mix and match freely.** Use `renderToReadableStream` for static content, `createCompositeComponent` when you need slots, or skip RSCs entirely for client-heavy routes. The architecture doesn't force a pattern on you.

---

## Why RSCs Matter

Before we dive into patterns, let's talk about when server components actually help:

- **Heavy dependencies stay on the server.** Markdown parsers, syntax highlighters, date formatting libraries—these can add hundreds of KB to your bundle. With RSCs, that code runs on the server and only the rendered HTML ships to the client. Your users' phones will thank you.

- **Colocated data fetching.** TanStack Router already eliminates waterfalls by parallelizing route loaders. RSCs offer a different ergonomic: await data directly in the component that renders it. Super convenient for static or slow-changing content.

- **Sensitive logic stays secure.** API keys, database queries, business logic—none of it reaches the client bundle. Ever.

- **Streaming for perceived performance.** RSCs stream UI progressively. Users see content immediately while slower parts load in the background. It just _feels_ fast.

Here's the thing: RSCs aren't about replacing client interactivity. They're about giving you the choice of where work happens. And that choice should be yours, not your framework's.

---

## Composition Patterns

Composite Components support two levels of composition. Let's look at both.

### Intra-component: Slots Inside One Component

A Composite Component can render server UI while exposing **slots** for client content. Slots use plain React patterns you already know:

- `children`
- render props (like `renderActions`)

Because the client owns the component tree, the components you pass into slots are regular client components. No `'use client'` directive required. The server positions them as opaque placeholders but can't inspect, clone, or transform them. That's what keeps the model predictable and, frankly, makes it easy to reason about.

#### Server

```tsx
import { createCompositeComponent } from '@tanstack/react-start/rsc'

const getPost = createServerFn().handler(async ({ data }) => {
  const post = await db.posts.get(data.postId)

  const src = await createCompositeComponent(
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

  return { src }
})
```

#### Client

```tsx
import { CompositeComponent } from '@tanstack/react-start/rsc'

function PostPage({ postId }) {
  const { data } = useSuspenseQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost({ data: { postId } }),
  })

  return (
    <CompositeComponent
      src={data.src}
      renderActions={({ postId, authorId }) => (
        // Full client interactivity: hooks, state, context
        <PostActions postId={postId} authorId={authorId} />
      )}
    >
      <Comments postId={postId} />
    </CompositeComponent>
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
import { createCompositeComponent } from '@tanstack/react-start/rsc'

const getPageLayout = createServerFn().handler(async () => {
  const [Header, Content, Footer] = await Promise.all([
    createCompositeComponent(() => <header>...</header>),
    createCompositeComponent(() => <main>...</main>),
    createCompositeComponent(() => <footer>...</footer>),
  ])

  return { Header, Content, Footer }
})
```

This keeps network overhead low while still giving you composable pieces. Each returned component can still expose its own slots.

---

## Caching

Here's where things get really nice. Server components are streams, but you don't have to think about that. TanStack Start integrates them with two caching layers you already know.

### Router: Automatic Route-Based Caching

TanStack Router caches loader data automatically. The cache key is the route path plus its params:

```tsx
import { CompositeComponent } from '@tanstack/react-start/rsc'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => ({
    Post: await getPost({ data: { postId: params.postId } }),
  }),
  component: PostPage,
})

function PostPage() {
  const { Post } = Route.useLoaderData()

  return (
    <CompositeComponent
      src={Post.src}
      renderActions={({ postId }) => <PostActions postId={postId} />}
    >
      <Comments />
    </CompositeComponent>
  )
}
```

Navigate from `/posts/abc` to `/posts/xyz` and the loader runs again. Navigate back to `/posts/abc` and Router serves the cached component instantly. Your users get that snappy back-button experience without you writing any caching logic.

Router caching is effectively zero-config for most routes. For more advanced cache key control (like including search params), check out [`loaderDeps`](/router/latest/docs/framework/react/guide/data-loading#using-loaderdeps-to-access-search-params) in the docs.

### Query: Fine-Grained Control

When you need more control, use TanStack Query. With Suspense you can treat the server component like any other async resource. You still get explicit cache keys, stale time, background refetching, and all the other Query features:

```tsx
import { CompositeComponent } from '@tanstack/react-start/rsc'

function PostPage() {
  const { postId } = Route.useParams()

  const { data } = useSuspenseQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost({ data: { postId } }),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <CompositeComponent
      src={data.src}
      renderActions={({ postId }) => <PostActions postId={postId} />}
    >
      <Comments postId={postId} />
    </CompositeComponent>
  )
}
```

Navigate away and back: cache hit, instant render, no network request. The RSC payload is the cache value. Query doesn't know it's caching a server component. It's just bytes that decode into a React element tree. For static content, just set `staleTime: Infinity` and you're done.

---

## How It Works

Curious about the magic? Here's what's happening under the hood.

When your server component accesses props, it accesses a proxy. Every property access and function call is tracked:

- `props.children` serializes as a slot placeholder
- `props.renderActions({ postId, authorId })` serializes with the arguments attached

You can destructure props normally—the proxy handles both `props.children` and `({ children })`.

**The rules are simple:** Slot placeholders are opaque on the server. You can't enumerate props with `Object.keys()` or serialize a render prop with `JSON.stringify()`. The [documentation](/start/latest/docs/server-components) covers the full contract.

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

Type safety flows through automatically. The function signature on the server determines what arguments your client function receives—no extra work required.

---

## Low-Level API: Full Control

The patterns above cover most use cases. But if you want to serve RSCs from API routes, build custom streaming protocols, or integrate with external systems, you can use the same Flight stream primitives directly.

### The Primitives

| Function                   | Where it runs | What it does                                      |
| -------------------------- | ------------- | ------------------------------------------------- |
| `renderToReadableStream`   | Server only   | Renders React elements to a Flight stream         |
| `createFromFetch`          | Client        | Decodes a Flight stream from a fetch response     |
| `createFromReadableStream` | Client/SSR    | Decodes a Flight stream from any `ReadableStream` |

### Example: RSC via API Route

Here's a minimal example serving an RSC from an API endpoint:

```tsx
// src/routes/api/rsc.tsx
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderToReadableStream } from '@tanstack/react-start/rsc'

const getFlightStream = createServerFn({ method: 'GET' }).handler(async () => {
  return renderToReadableStream(
    <div>
      <h1>Hello from the server</h1>
      <p>This is a Flight stream served via API route.</p>
    </div>,
  )
})

export const Route = createFileRoute('/api/rsc')({
  server: {
    handlers: {
      GET: async () => {
        const stream = await getFlightStream()
        return new Response(stream, {
          headers: { 'Content-Type': 'text/x-component' },
        })
      },
    },
  },
})
```

And on the client:

```tsx
import { createFromFetch } from '@tanstack/react-start/rsc'

function GreetingLoader() {
  const [content, setContent] = React.useState(null)

  React.useEffect(() => {
    createFromFetch(fetch('/api/greeting')).then(setContent)
  }, [])

  return content ?? <div>Loading...</div>
}
```

This gives you complete control over how RSC content is generated and consumed. Use it for custom caching layers, WebSocket-based streaming, or anything else the high-level helpers don't cover.

---

## Security: One-Way Data Flow

Let's talk about something important. You may have seen recent CVEs affecting RSC implementations in other frameworks. Here's why TanStack Start isn't vulnerable to those same issues.

The core difference is simple: **TanStack Start's server functions don't accept or parse incoming Flight data.** Payloads flow in one direction only: server to client.

Other RSC implementations use the `'use server'` directive to create Server Actions that parse Flight data sent _from_ the client. That bidirectional flow is where the vulnerabilities live. When your server parses untrusted Flight payloads, you're exposed to deserialization attacks and prototype pollution.

We took a fundamentally different approach. TanStack Start uses `createServerFn` for server functions. These are regular functions that receive JSON input, validate it with your middleware, and return data. They don't accept Flight streams. They don't parse React's wire format from untrusted sources.

The result: server-rendered RSC content streams to your client, but the client never sends Flight data back. No parsing of untrusted RSC payloads means no exposure to those attack vectors.

That said, treat your server functions like any API surface: authenticate requests, validate inputs, and keep React patched. Security is always defense in depth. But you can use Composite Components knowing they aren't susceptible to the same class of vulnerabilities that have affected other frameworks.

---

## The Full Spectrum

With RSCs as primitives, TanStack Start covers every frontend use case. And we mean _every_:

- **Fully Interactive**  
  No server components at all. Client-first, SPA-style. RSCs are an optimization you add when helpful, not a paradigm you're forced to build around.

- **Hybrid**  
  Server components for static shells, data-heavy regions, or SEO-critical content. Slots for interactivity. Mix freely within the same component. This is where most apps will land.

- **Fully Static**  
  Pre-render everything at build time. No hydration, no JavaScript. Just ship HTML.

**One framework. One mental model. The entire spectrum.**  
You don't have to choose "interactive framework" or "static framework" or "RSC framework."  
You choose patterns **per-route, per-component, per-use-case**. The architecture supports all of it. Because, again, you know what's best for your app.

---

## Current Status: Experimental

RSC support is experimental in TanStack Start RC and will remain experimental into early v1.

**Serialization:** This release uses React's native Flight protocol. TanStack Start's usual serialization features aren't available within server components for now.

**API surface:** The `createCompositeComponent`, `renderToReadableStream`, and related APIs are stable in design but may see refinements.

If you hit rough edges, [open an issue](https://github.com/tanstack/router/issues) or join the [Discord](https://tlinz.com/discord).

---

## FAQ

We get questions. Here are answers.

### How does this compare to Next.js App Router?

Next.js App Router is server-first: your component tree lives on the server by default, and you opt into client interactivity with `'use client'`.

TanStack Start is **isomorphic-first**: your tree lives wherever makes sense. The key difference is **client-led composition**. Composite Components expose slots so the client assembles the final tree. You're in control.

### Can I use this with Next.js or Remix?

Not directly—TanStack Start is its own framework. But if you use TanStack Query or Router already, the mental model transfers.

### Do I have to use RSCs?

Nope. RSCs are completely opt-in. You can build fully client-side routes (including `ssr: false`), use traditional SSR without server components, or go fully static.

Composite Components are just another primitive. They compose with Start features like Selective SSR and with TanStack Query and Router caching, instead of replacing them.

### What about React 19 and Server Actions?

TanStack Start uses React's Flight protocol and works with React 19. `createServerFn` serves a similar purpose to Server Actions but integrates with TanStack's middleware, validation, and caching. We're watching the Server Actions API and will align where it makes sense.

### Can I define components outside the RSC helpers?

Yes. Define your component separately and invoke it inside `createCompositeComponent` or `renderToReadableStream`. The helpers just initiate the RSC stream—they don't care where your JSX comes from.

### Can I return raw JSX without the RSC helpers?

No. `renderToReadableStream` and `createCompositeComponent` enable streaming, slot handling, and client rehydration. Plain JSX from a server function won't have RSC behavior.

### Do `cloneElement` and React Context work with server component children?

**cloneElement:** No—client children are slot placeholders. The server can't inspect or clone them. (This is actually a feature, not a bug. It keeps the model predictable.)

**React Context:** Yes! Providers in server components wrap client children just fine. The context must work across the boundary (typically `'use client'` on the provider component).

### What about security?

See the [Security: One-Way Data Flow](#security-one-way-data-flow) section above. The short version: TanStack Start's architecture doesn't parse Flight data from the client, so recent CVEs affecting other RSC frameworks don't apply here.

---

## Your RSCs, Your Way

We started this post with a simple idea: you know what's best for your application architecture. That's why we built the low-level API and Composite Components the way we did.

Other frameworks tell you how RSCs have to work. We give you primitives and let you decide. Want a fully interactive SPA? Go for it. Want to sprinkle in server components for heavy lifting? Easy. Want to go full static? That works too. The architecture supports all of it because _your_ app isn't one-size-fits-all, and your framework shouldn't be either.

TanStack Start's RSC model is available now as an experimental feature. We're excited to see what you build with it.

- [Documentation](https://tanstack.com/start)
- [GitHub](https://github.com/tanstack/router)
- [Discord](https://tlinz.com/discord)

Let's build something amazing together.
