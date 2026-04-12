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

At TanStack we have always strived to build tools that cover the 90% use case with ease, but still give you the flexibility to break out of the box for advanced and powerful use cases. Why? Because we know that when things get serious, **you know what's best for your application and deserve the freedom to take control**. That's always been the TanStack philosophy, and we're happy that it's taken us this long to deliver that same experience with React Server Components.

Here's why we got excited about RSCs in the first place: smaller bundles, streaming UI, and moving heavy work off the client. Can they be used to build an entire framework, eliminate client-side waterfalls, and shape your entire application architecture? Yes, but similar to trying to use a single tool to build an entire house, no tool is a silver bullet.

## The RSC Status Quo

In most current server-composed RSC setups, the server owns the component tree, you opt into interactivity with `'use client'`, and the server decides the final shape of the UI. Client components can render and hydrate on the client, but the server still owns the destiny.

This model only works if you trust that your server can know everything necessary to decide the final shape of the UI, and if you are willing to keep going back to the server to rebuild and reconcile new UI in response to new data and user actions. On paper, this server-first, "RSC-native" experience looks simple and elegant, but in practice it makes the lifecycle of your application artificially constrained by RSCs' trade-offs and tightly coupled to the framework that implements them.

We think you deserve more control than these historically tightly coupled, monolithic, black-box APIs.

What if you could use RSCs as granularly as you could fetch JSON? Without giving up control over your component tree? What if the client decided how server-rendered UI gets fetched, cached, and composed?

In TanStack Start, the core idea is that RSCs are data you can fetch, cache, and render on your terms instead of a server-owned tree. That alone already makes them more composable from the client side. But you know we couldn't help ourselves. We wanted even more flexibility.

So we built something new called **Composite Components** that pushes client-led composition even further. We'll come back to that. But first...

---

## Why Do RSCs Matter?

Before we talk APIs or patterns, let's get real about practical cases for RSCs:

- **Heavy dependencies stay on the server.** Markdown parsers, syntax highlighters, date formatting libraries, search indexing, content transforms. If the browser does not need that code, it should not download that code.
- **Streaming improves responsiveness.** Streaming early markup and data to the client while slower stuff resolves gradually is a boon when users need feedback. RSCs help enable that even more.
- **Data fetching can live closer to the UI that needs it.** Don't misunderstand though, we do not see RSCs on their own as some automatic waterfall win. TanStack Router already does so much important and hard work on parallel loading and waterfall prevention, but what RSCs add is a different ergonomic: sometimes it is just cleaner to colocate data fetching with the server-rendered UI that uses it.

Sometimes, moving some logic to the server makes the client parts easier to do right, and cheaper too. And that gets a lot more interesting when you **stop assuming the server has to own the whole tree**.

## A Different RSC Model

The server-first model is the default most people now associate with RSCs. We get it. Next.js's interpretation of RSCs has dominated the discourse for years now. But something always just felt off. We kept coming back to the same question: why should RSCs have to own your whole tree just to be worth using?

With TanStack Start, RSCs are just React Flight streams. That sounds almost too obvious to say out loud, but that was exactly the point. We did not want them wrapped in a black-box architecture that takes over your whole app.

We wanted RSCs to behave more like any other piece of server data: fetchable, cacheable, renderable, and composable under your control.

That means you can return them from a server function, decode them on the client, cache them with Router or Query, and render them where they fit. The server still does the server-rendered work. The client just is not forced to surrender the whole tree up front.

The wire format is still standard React Flight. The mental model is simple: server components are data. You fetch them, you cache them, you render them. If you want setup details and the exact API surface, the [Server Components docs](/start/latest/docs/server-components) are the source of truth.

Here is an RSC in TanStack Start:

```tsx
const getGreeting = createServerFn().handler(async () => {
  return renderToReadableStream(<h1>Hello from the server</h1>)
})

function Greeting() {
  const stream = React.use(getGreeting())
  return React.use(createFromReadableStream(stream))
}
```

I know what you're thinking... this still looks a little low-level.

**Don’t take this as “how you should render every RSC”** 😅. Consider it a deliberately primitive example to make the base model obvious before we add ergonomic layers. There’s almost nothing hidden here: no special files, no framework-owned tree, **no magic**. Just a server function returning a Flight stream, and the client rendering it.

---

## The Primitive APIs

At the primitive level, the API surface is intentionally small:

- **`renderToReadableStream`** renders React elements to a Flight stream on the server.
- **`createFromReadableStream`** decodes a Flight stream on the client or during SSR.
- **`createFromFetch`** decodes directly from a fetch response when that shape is more convenient.

That is enough to build a lot. You can treat RSC output like any other async resource in your app instead of a framework-owned tree that you have to route every decision through.

And if you want the exact APIs, examples, constraints, and low-level details, we have that documented in the [Server Components docs](/start/latest/docs/server-components).

---

## Caching

Once you treat RSCs like data, the caching story gets a lot simpler. And because these are just granular Flight streams delivered plainly over HTTP, they are not only easy to cache on the client, but also anywhere along the way on the server too: in memory, in a database, behind a CDN, or wherever else your architecture already caches bytes and responses.

This equally applies to **caching layers you likely already know on the client** as well, instead of requiring novel approaches and mental model shifts.

Let me explain.

### Query: Fine-Grained Control

TanStack Query illustrates this so well. It does not need a special "RSC mode". Once the RSC payload is part of an async query, you still get explicit cache keys, `staleTime`, background refetching, and the rest of Query's toolbox. For static content, just set `staleTime: Infinity` and you are done.

```tsx
const getGreeting = createServerFn().handler(async () => {
  return renderToReadableStream(<h1>Hello from the server</h1>)
})

function PostPage({ postId }: { postId: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['greeting-rsc', postId],
    queryFn: async () => ({
      Greeting: await createFromReadableStream(await getGreeting()),
    }),
    staleTime: 5 * 60 * 1000,
  })

  return <>{data.Greeting}</>
}
```

### Router: Automatic Route-Based Caching

TanStack Router is even cooler. It can fetch RSC payloads in route loaders and cache the result like any other loader output.

```tsx
const getGreeting = createServerFn().handler(async () => {
  return renderToReadableStream(<h1>Hello from the server</h1>)
})

export const Route = createFileRoute('/hello')({
  loader: async () => createFromReadableStream(await getGreeting()),
  component: function HelloPage() {
    const greeting = Route.useLoaderData()
    return <>{greeting}</>
  },
})
```

Navigate from `/posts/abc` to `/posts/xyz` and the loader runs again. Navigate back to `/posts/abc` and Router can serve the cached result instantly. That snappy back-button experience falls out of the same loader caching model you are already using.

That is one of the nicest parts of this model. **RSCs stop feeling like a separate universe** and start feeling like something your existing data tools can already work with.

---

## Under The Hood

Under the hood, the primitive story is straightforward: React renders to a Flight stream on the server, and the client decodes that stream back into a React element tree.

There is no secret extra protocol here. That is the primitive. Standard Flight streams in, standard React elements out.

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
  Server components for static shells, data-heavy regions, or SEO-critical content, with client components where interactivity matters. This is where most apps will land.

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

## Then We Pushed It Further

Everything above stands on its own. If all TanStack Start did was treat RSCs as fetchable, cacheable, renderable data, we would already think that was a better foundation for RSCs.

But we kept pulling on one question: what if the server did not need to decide every client-shaped part of the UI at all?

That led us to **Composite Components**.

`use client` still matters when the server intentionally wants to render a client component. Composite Components are for the opposite case. The server can leave join points for client UI without needing to know what goes there.

That is the part that feels genuinely new to us. Most RSC systems let the server decide where client components render. Composite Components let the server leave that decision open.

### Slots Inside One Component

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

- A render prop slot for `<PostActions>` with server-provided arguments
- A `children` slot for `<Comments>`

Since a Composite Component is still data, the client can also treat it as a building block:

- Interleave multiple fragments in a new tree
- Wrap them in client providers or layouts
- Nest them through slots
- Reorder or swap them based on client state

Same mental model as normal React composition. The difference is that the server no longer has to decide every interesting part of the tree ahead of time.

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
