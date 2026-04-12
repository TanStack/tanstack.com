---
title: 'React Server Components Your Way'
published: 2026-04-13
draft: true
excerpt: RSCs are genuinely exciting — smaller bundles, streaming UI, moving heavy work off the client — but existing implementations force you into a one-size-fits-all pattern. What if you could fetch, cache, and compose them on your own terms?
authors:
  - Manuel Schiller
  - Tanner Linsley
  - Jack Herrington
---

![React Server Components](/blog-assets/react-server-components/header.jpg)

**You know what's best for your application architecture.** That's always been the TanStack philosophy, and it's exactly how we approached React Server Components.

Here's the thing: RSCs are genuinely exciting. Smaller bundles, streaming UI, moving heavy work off the client.

In most current RSC setups, the server owns the component tree. You opt into interactivity with `'use client'`. The server decides the shape of the UI, and the client mostly hydrates or fills in the interactive parts.

That model has real benefits. It makes server rendering, streaming, and colocated server-side work feel built in. But it also turns RSCs from a useful primitive into the thing your whole app has to orbit.

We think you deserve more control than that.

What if you could use RSCs without giving up control over your component tree? What if the client could still decide how server-rendered UI gets fetched, cached, and composed?

That's the direction we took in **TanStack Start**. The core idea is that RSCs are data you can fetch, cache, and render on your terms instead of a server-owned tree. That alone already makes them more composable from the client side. And on top of that, we built something new called **Composite Components** that pushes that idea even further. We'll get to that in a second. The bigger point is simpler: RSCs should be a tool, not an architecture mandate.

---

## Why RSCs Matter

Before we talk APIs or patterns, here is the practical case for RSCs:

- **Heavy dependencies stay on the server.** Markdown parsers, syntax highlighters, date formatting libraries, search indexing, content transforms. If the browser does not need that code, it should not download that code.
- **Streaming improves perceived performance.** You can start sending useful UI immediately while slower parts finish in the background.
- **Data fetching can live closer to the UI that needs it.** That is an ergonomic shift, not a magic waterfall fix. TanStack Router already does the heavy lifting on parallel data loading. RSCs just let you colocate data with the server-rendered UI that uses it when that model fits better.

RSCs are not about replacing client interactivity. They are about moving the right work to the server and leaving the rest alone.

## A Different RSC Model

That server-first model is the default most people now associate with RSCs. It is useful, but we do not think RSCs should have to own your whole tree just to be worth using.

In TanStack Start, RSCs can be fetchable, cacheable, renderable data instead of a server-owned application tree. You can render server output where it fits instead of surrendering composition up front.

That is already a meaningful shift. The client can treat server output as a building block.

**Composite Components** are the next step. They do not just let the client render server output. They let the server leave composition holes for client UI without deciding what that UI is.

This is not just a nicer RSC API. It is a different composition model.

That is a real inversion of control back to the client. `use client` still matters when the server wants to render a client component on purpose. Composite Components are for the opposite case: the server does not need to know what gets rendered there at all.

Most RSC models let the server decide where client components render. This lets the server leave that decision open.

In practice, that means you can:

- Cache RSC output across navigations
- Interleave server UI with client state
- Reuse the same server fragments in multiple layouts
- Combine RSCs with Router and Query instead of replacing them

The wire format is still standard React Flight. The mental model is simple: server components are data. You fetch them, you cache them, you render them. If you want setup details and the exact API surface, the [Server Components docs](/start/latest/docs/server-components) are the source of truth.

---

## Two Approaches, Your Choice

At the API level, TanStack Start gives you a baseline primitive path and an advanced composition path, and you can use either, both, or neither depending on the route.

- **`renderToReadableStream` + `createFromReadableStream`** for straightforward server-rendered output you can fetch, cache, and render on the client.
- **`createCompositeComponent`** when you want to go further and hand composition control back to the client with slots.

That is the distinction that matters most. Use the stream helpers when you just want RSCs as composable data. Reach for Composite Components when the client should assemble the final tree and the server should not have to know what fills every interactive region.

And if you want the exact APIs, examples, constraints, and low-level details, we have that documented in the [Server Components docs](/start/latest/docs/server-components).

---

## Composition Patterns

The interesting part is not the helper names. It is the composition model. This is where Composite Components stop being "RSCs as data" and become something genuinely new, not just another helper around the same underlying pattern.

### Intra-component: Slots Inside One Component

A Composite Component can render server UI while exposing **slots** for client content. Slots use plain React patterns you already know:

- `children`
- render props (like `renderActions`)

Because the client owns the component tree, the components you pass into slots are regular client components. No `'use client'` directive required. The server positions them as opaque placeholders but can't inspect, clone, or transform them. That is the point: the server can ask for "something goes here" without needing to know what that something is.

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

Since a Composite Component is still just data, the client can also treat it as a building block:

- Interleave multiple fragments in a new tree
- Wrap them in client providers or layouts
- Nest them through slots
- Reorder or swap them based on client state

Same mental model as normal React composition. That is the real point.

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

## Under The Hood

The important detail is simple: slots serialize as opaque placeholders in the Flight stream, and the client replays them with the arguments the server provided.

That means the server can position client UI, but it cannot inspect or transform it. That constraint is what keeps the model predictable.

If you want the exact serialization contract or the low-level stream APIs, the [Server Components docs](/start/latest/docs/server-components) cover them.

---

## Security: One-Way Data Flow

Let's talk about something important. You may have seen recent CVEs affecting RSC implementations in other frameworks. Here's why TanStack Start isn't vulnerable to those same issues.

The core difference is simple: **TanStack Start's server functions don't accept or parse incoming Flight data.** Payloads flow in one direction only: server to client.

Other RSC implementations use the `'use server'` directive to create Server Actions that parse Flight data sent _from_ the client. That bidirectional flow is where the vulnerabilities live. When your server parses untrusted Flight payloads, you're exposed to deserialization attacks and prototype pollution.

We took a fundamentally different approach. TanStack Start uses `createServerFn` for server functions. These are regular functions that receive JSON input, validate it with your middleware, and return data. They don't accept Flight streams. They don't parse React's wire format from untrusted sources.

The result: server-rendered RSC content streams to your client, but the client never sends Flight data back. No parsing of untrusted RSC payloads means no exposure to those attack vectors.

That said, treat your server functions like any API surface: authenticate requests, validate inputs, and keep React patched. Security is always defense in depth. But you can use TanStack Start's RSC model knowing it is not susceptible to the same class of vulnerabilities that have affected other frameworks.

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

## What We Saw On TanStack.com

We did not want to make the case with vibes, so we migrated the content-heavy parts of tanstack.com and measured it.

The result was exactly what we hoped for, and also more limited than the hype would suggest.

The best pages got meaningfully smaller:

- **Blog post pages** dropped about **153 KB gzipped** from the client JS graph.
- **Docs pages** dropped about **153 KB gzipped**.
- **Docs example pages** dropped about **40 KB gzipped**.

And the real-world numbers moved with them:

- **`/blog/react-server-components`** went from **52 -> 74** in Lighthouse.
  - Total Blocking Time dropped from **1,200ms -> 260ms**.
  - Transfer size dropped from **1,101 KiB -> 785 KiB**.
- **`/router/latest/docs/overview`** went from **78 -> 81**.
  - Total Blocking Time dropped from **280ms -> 200ms**.
  - Transfer size dropped from **917 KiB -> 777 KiB**.

That is the point. **Heavy client work stopped shipping to the client.** Markdown parsing went away. Syntax highlighting went away. The browser got less JavaScript and did less work. As a side effect, we also got to delete the old client markdown and highlighting path instead of carrying two versions of the same rendering logic around.

But RSCs are not a universal coupon code for performance. Some landing pages were basically flat, and a few were slightly worse. Pages that are already dominated by interactive UI shell do not automatically get faster just because you threaded a server component into the tree somewhere.

That is the tradeoff:

- **RSCs are great when the page is content-heavy, dependency-heavy, or both.** Docs, blogs, markdown pipelines, syntax highlighting, slow-changing content, SEO-heavy pages. That is the sweet spot.
- **RSCs are less obviously useful when the page is already mostly client state and interaction.** Dashboards, builders, long-lived app sessions, and some landing pages can be flat or mixed unless you are removing real client-side work.

That is why we think they matter. Not because every route should become a server component. Because when you use them where they fit, the payoff is measurable and not subtle.

---

## Current Status: Experimental

RSC support is experimental in TanStack Start RC and will remain experimental into early v1.

**Serialization:** This release uses React's native Flight protocol. TanStack Start's usual serialization features aren't available within server components for now.

**API surface:** The current helpers are stable enough to use, but expect refinements while the feature is experimental. The docs will stay current as the APIs evolve.

If you hit rough edges, [open an issue](https://github.com/tanstack/router/issues) or join the [Discord](https://tlinz.com/discord).

---

## FAQ

We get questions. Here are answers.

### How does this compare to Next.js App Router?

Next.js App Router is server-first: your component tree lives on the server by default, and you opt into client interactivity with `'use client'`.

TanStack Start is **isomorphic-first**: your tree lives wherever makes sense. At the base level, RSC output can be fetched, cached, and rendered where it makes sense instead of owning the whole tree. When you want to go further, Composite Components let the client assemble the final tree instead of just accepting a server-owned one.

### Can I use this with Next.js or Remix?

Not directly—TanStack Start is its own framework. But if you use TanStack Query or Router already, the mental model transfers.

### Do I have to use RSCs?

Nope. RSCs are completely opt-in. You can build fully client-side routes (including `ssr: false`), use traditional SSR without server components, or go fully static.

They are another tool in the box, not the new mandatory center of gravity.

### Where should I look for the full technical docs?

The [Server Components docs](/start/latest/docs/server-components). They cover setup, helper APIs, examples, constraints, and the low-level details this post intentionally skips.

### What about security?

See the [Security: One-Way Data Flow](#security-one-way-data-flow) section above. The short version: TanStack Start's architecture doesn't parse Flight data from the client, so recent CVEs affecting other RSC frameworks don't apply here.

---

## Your RSCs, Your Way

We started this post with a simple idea: you know what's best for your application architecture. That is why we built TanStack Start's RSC model to stay flexible instead of prescriptive.

Too much of the ecosystem treats RSCs like they need to become your app architecture. We think they work better as a primitive. And when you want to go further, Composite Components open up a composition model that most RSC systems do not even try to offer. Want a fully interactive SPA? Go for it. Want to sprinkle in server components for heavy lifting? Easy. Want to go full static? That works too. The architecture supports all of it because _your_ app isn't one-size-fits-all, and your framework shouldn't be either.

TanStack Start's RSC model is available now as an experimental feature. We're excited to see what you build with it.

- [Server Components Docs](/start/latest/docs/server-components)
- [GitHub](https://github.com/tanstack/router)
- [Discord](https://tlinz.com/discord)

Let's build something amazing together.
