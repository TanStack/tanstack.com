---
title: 'Who Owns the Tree? RSC as a Protocol, Not an Architecture'
published: 2026-04-28
draft: false
excerpt: RSC is usually framed as a single architecture where the server owns the tree. But it's also a protocol, and the protocol supports more than one composition model. The overlooked question is who owns the tree.
library: start
authors:
  - Tanner Linsley
redirect_from:
  - rsc-is-a-protocol-before-it-is-an-architecture
  - who-owns-the-tree-rsc-is-a-protocol-not-an-architecture
---

![Who Owns the Tree?](/blog-assets/who-owns-the-tree/header.jpg)

A few weeks ago we shipped [React Server Components Your Way](/blog/react-server-components), and the most common follow-up was:

> Why even bother with two RSC composition models? Pick one.

When most people talk about RSCs, they're usually referencing one specific architecture where the server owns the tree, `'use client'` marks the holes, and the framework stitches everything together at hydration. That's the model that people have in their heads when they say "RSC support".

It's an important model and even more important that people know and understand that TanStack Start supports it, but...

RSC is also a _protocol_, a way to serialize rendered React output, client refs, and non-JSON stuff into a stream that can be streamed to the client and reconstructed. The "conventional" server-owned tree is just **one way** to use that protocol.

**So, who owns the tree?**

If and when the server owns it, you need a way to drop client interactivity _into_ it, which is exactly what `'use client'` is for. Hopefully this doesn't come as a surprise. It's in the react docs and how pretty much every RSC framework model works to this day, including Start.

However, if the _client_ owns it, you'll need a way to drop _server-rendered UI into it_. That's what Composite Components solve in TanStack Start.

Both of these models are powered by the same protocol.

## It matters more often than you think

Alright, imagine you're building a dashboard where the client owns almost everything: tabs, filters, drag layout, optimistic updates, the command palette, all of it. But one chart happens to pull from a crappy and slow analytics API, runs a bunch of server-only computation and happens to require hundreds of kilobytes of charting code just to produce the markup.

In the server-owned model approach, the obvious solution is to invert your whole route to the server, marking every interactive component along the way with `'use client'` and hope that the boundaries land where you want them.

Don't get me wrong, this totally works. People do this every day in Next.js. But what you _really_ just did was adopted a server-first architecture for your whole app just to render _one single server-shaped region_ into a mostly client-side controlled tree.

Now imagine the opposite being possible. Just keep the dashboard client-owned, ask the server through api/server function for the rendered chart markup, then drop it into the tree wherever you want, alongside whatever client state you already have.

```tsx
import { createFromReadableStream } from '@tanstack/react-start/rsc'

function Dashboard() {
  const { data: chart } = useSuspenseQuery({
    queryKey: ['analytics-chart', range],
    queryFn: async () =>
      createFromReadableStream(await getAnalyticsChart({ data: { range } })),
  })

  return (
    <DashboardShell>
      <Filters />
      <Tabs>
        <Tab label="Overview">
          {/* Server-rendered output, dropped into a client-owned tree */}
          {chart}
        </Tab>
        <Tab label="Raw">
          <ClientOnlyTable />
        </Tab>
      </Tabs>
    </DashboardShell>
  )
}
```

The seam just moved a bit, and it's more transparent than what you're used to. And guess what, it's a totally valid and _awesome_ way to use the RSC protocol.

## Both models can reach the extremes

There is a fun symmetry here where both models can reach the _opposite_ extreme pretty easily.

If you use a Server-owned model, just push `'use client'` high enough in the tree and the route effectively becomes an SPA. The server still owns the outer entry, but everything below the boundary is client-composed.

If it's client-owned, render a server component as high as you can in the tree and the route suddenly behaves like a server-rendered page.

Something interesting to point out though is that in \*both models, the client still receives and composes the result, even if that result is fully server-rendered\*\*.

So the real distinction isn't which model can technically reach which outcome. Both can do it. It's more about which side the framework _naturally pulls you toward_, and how much friction you hit when you move the other direction.

If you're shipping an eventual-SPA, the client is the final destination of the UI whether you like it or not, which is why I frequently make the case that the "client-owned" composition model with strong server composition primitives covers more ground and capability than the other. It keeps the control layer rooted where the user experience actually runs while still letting you do server-rendered regions, server-only computation, streaming, caching, and progressive enhancement wherever they make sense.

## Why most frameworks only ship half

The standard RSC model assumes server-owned trees, so the primitives are designed around that direction. `'use client'`, hydration boundaries, streaming, suspense fences, manifest-driven reference resolution all assume the server is composing and the client is receiving.

That's fine for what those frameworks were built for and \*\*TanStack Start supports `'use client'` exactly the same.

However, other frameworks don't really have a great answer when you ask:

> How do I render this server fragment inside a client tree I'm already composing?

or

> How can I fetch and cache a server component from a useQuery/useEffect?

The closest answer is usually "make the client thing a `'use client'` boundary inside a server tree" which works when the route is server-shaped, but when the route is _client-shaped_, you're inverting the entire architecture for little ROI.

**Composite Components fill that gap.** A server function returns a rendered React fragment as Flight data. The client passes it to `<CompositeComponent>` and provides slots through `children` or render props. The server-rendered fragment can position those slots, but the client still owns the surrounding tree.

```tsx
// server
const getPost = createServerFn().handler(async ({ data }) => {
  const post = await db.posts.get(data.postId)
  return {
    src: await createCompositeComponent(
      ({ children }: { children?: React.ReactNode }) => (
        <article>
          <h1>{post.title}</h1>
          <p>{post.body}</p>
          <footer>{children}</footer>
        </article>
      ),
    ),
  }
})

// client
function PostPage({ postId }: { postId: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost({ data: { postId } }),
  })

  return (
    <CompositeComponent src={data.src}>
      <Comments postId={postId} />
    </CompositeComponent>
  )
}
```

This is _additive_ and textbook **inversion of control**. Yes, start still supports `'use client'` when you want server-owned composition, but Composite Components enable the same idea from the opposite control plane.

This isn't even foreign to React's original framing. The first Server Components RFC describes Client Components as the regular components you already know, and notes that Server Components can pass other Server Components _as children_ to Client Components. From the Client Component's perspective, that child is already rendered output. The same RFC also describes granular refetching from multiple entry points as part of the design direction even though the initial demo refetched the whole app.

So ironically, this inverse model is _even closer_ to the original concepts by taking the protocol seriously and exposing a composition direction the protocol already makes possible.

## A powerful primitive, not the whole pipeline

"RSC support" is a phrase that feels overused and overstated to mean something like "correct" or "blessed", which is a weird thing to say about a primitive. I think more accurately, frameworks are using the RSC primitives in the way that has been **revealed and marketed to them thus far**, which is fine if that model covers your use cases. Ours needed more.

RSC is more than serialization. It's React's attempt to bring data fetching, streaming, code splitting, server access, and client interactivity into one coherent model. Worthy goal, but it's still _one way_ to organize those concerns, and most of those concerns already have great answers elsewhere in the ecosystem.

Routing solves waterfalls. Loaders kick off data work before render. Query libraries dedupe, cache, prefetch, stream, and invalidate. HTTP and CDNs cache responses. Server functions expose backend work without dragging the whole tree onto the server.

So the question isn't whether RSC _can_ solve these problems. It can. The question is whether routing every concern through a rigid RSC architecture should be the **default answer for every app**.

Start's answer is no. RSC is a powerful primitive in the pipeline, not the pipeline itself. Use it where rendered server UI is the right abstraction, and use the rest of the toolkit where those fit better. That's not rejecting RSC, it's rejecting RSC-as-silver-bullet for problems smaller, more composable tools already solve.

That same instinct is why Start also doesn't ship a caching directive.

## Why Start doesn't ship a caching directive

People keep asking why we don't ship something like Next's `"use cache"`. Short answer: that directive assumes a framework- or platform-owned persistence layer, and Start can't honestly make that assumption.

The directive marks something cacheable and the runtime handles the rest; keys, storage, invalidation, durability, cross-instance sharing, all the deployment-specific stuff. Which means the framework (or the platform under it) has to own the persistence contract. The directive doesn't _eliminate_ that question, it just hides it behind a one-liner at the call site.

That works great when your framework is married to a specific platform. Start isn't. Cloudflare Workers, Netlify, Vercel, Node, Bun, Railway, any Nitro target; there's no single portable persistence layer across all of that, so there's no honest directive shape that means the same thing everywhere.

Start takes the transparent route instead. A server function returns a Flight stream as bytes, and those bytes can be cached at any layer you already control.

| Layer       | Cache option                                            |
| ----------- | ------------------------------------------------------- |
| Render pass | `React.cache` to dedupe calls within a render           |
| Server      | Redis, KV, Postgres, in-memory LRU, or whatever you use |
| Network     | HTTP caching and `Cache-Control` headers                |
| Client      | Router cache, TanStack Query, or any client-side store  |

`createFromReadableStream` decodes the bytes at render time, after the cache boundary. The cacheable primitive isn't a directive that hides persistence; it's transparent RSC output flowing through cache layers your app already understands.

A directive is the right shape when the framework and platform can own the cache contract. Transparent bytes is the right shape when the framework needs to stay portable. We chose portable.

## Closing

The better question isn't "does this framework support RSC?" It's:

> Which RSC composition models does it expose?

TanStack Start exposes both, and you can mix them per route, per component, per use case. Same TanStack philosophy as always: you know what's best for your application, and the framework should get out of the way.

---

If you've been waiting for an RSC story that doesn't ask you to invert your whole architecture, this is it. RSC support in TanStack Start is [experimental and ready to play with](/start/latest/docs/framework/react/guide/server-components).
