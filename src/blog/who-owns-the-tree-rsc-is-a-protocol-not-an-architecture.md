---
title: 'Who Owns the Tree? RSC Is a Protocol, Not an Architecture'
published: 2026-04-28
draft: true
excerpt: RSC is usually framed as a single architecture where the server owns the tree. But it is also a protocol, and the protocol supports more than one composition model. The overlooked question is who owns the tree.
authors:
  - Tanner Linsley
redirect_from:
  - rsc-is-a-protocol-before-it-is-an-architecture
---

A few weeks ago we shipped [React Server Components Your Way](/blog/react-server-components), and the most common follow-up was a fair one:

> Why even bother with two RSC composition models? Pick one.

So here is the deeper answer.

When most people argue about RSC, they are really arguing about one specific architecture: the server owns the tree, `'use client'` marks the holes, the framework stitches everything together at hydration. That is the model. That is what people mean when they say "RSC support".

That model is real, it is important, and TanStack Start supports it.

But it is not the whole of RSC.

RSC is also a _protocol_ — a way to serialize rendered React output, client references, and non-JSON values into a stream that can be sent over the wire and reconstructed somewhere else. The conventional server-owned tree is **one way** to use that protocol. It is not the only way.

The question that gets buried under the conventional model is the simple one:

**Who owns the tree?**

If the server owns it, you need a way to drop client interactivity _into_ it. That is `'use client'`. Standard model.

If the _client_ owns it, you need a way to drop server-rendered UI _into_ it. That is what Composite Components solve in TanStack Start.

Same protocol. Different direction. Different problems.

## Why this matters

Let's make this concrete. You're building a dashboard. The client owns tabs, filters, drag layout, optimistic updates, the command palette, all of it. But one chart pulls from a slow analytics API, runs server-only computation, and would ship hundreds of kilobytes of charting code if you rendered it on the client.

In the server-owned model, the natural answer is to invert your whole route. Move the dashboard onto the server. Mark every interactive piece with `'use client'`. Hope the boundaries land where you want them.

That works. But you just adopted a server-first architecture to render _one server-shaped region_.

The inverse approach is much simpler. Keep the dashboard client-owned. Ask the server for a rendered chart fragment. Drop it into the tree wherever you want, alongside whatever client state you already have. If the chart has no interactive client regions, you don't even ship a client chunk for it.

```tsx
import { CompositeComponent } from '@tanstack/react-start/rsc'

function Dashboard() {
  const { data } = useSuspenseQuery({
    queryKey: ['analytics-chart', range],
    queryFn: () => getAnalyticsChart({ data: { range } }),
  })

  return (
    <DashboardShell>
      <Filters />
      <Tabs>
        <Tab label="Overview">
          {/* Server-rendered, dropped into a client-owned tree */}
          <CompositeComponent src={data.src} />
        </Tab>
        <Tab label="Raw">
          <ClientOnlyTable />
        </Tab>
      </Tabs>
    </DashboardShell>
  )
}
```

Same protocol underneath. Same Flight format. Same renderer. The seam just moved.

That is not a workaround for RSC. It is another valid way to use the RSC protocol.

## The real question: who owns the tree?

Composing UI across a network boundary is fundamentally an ownership problem. One side owns the tree. The other side fills regions of it. The interesting question is which side decides what goes where.

### Server-owned trees

In the standard RSC model, the server owns the tree. You write server components, mark the parts that need interactivity with `'use client'`, and the framework handles the rest. At hydration, the client receives the rendered tree along with a manifest mapping client references to actual modules, and React hydrates the interactive regions.

The seam is placed by the server. The server says, "this region is interactive, and _this_ client component fills it."

The client receives a tree it didn't compose. It hydrates what arrived.

This is the model Next.js builds around, and it is coherent. It fits when the server is the natural owner of the page — content-heavy routes, marketing pages, SEO-driven content, the kind of page where the tree shape is mostly a function of server data.

### Client-owned trees

The inverse model gets discussed less because most frameworks don't expose a primitive for it. So let's say it out loud:

What if the _client_ owns the tree, and the server fills server-shaped regions on request?

This is the natural shape of a lot of the apps you actually ship. Dashboards, builders, admin tools, editors, data apps — anything where routing, layout, and interactivity live primarily on the client.

In this model, you write a client tree like normal. Where you want server-rendered content, you leave a slot. The server renders content shaped for that slot and ships it as data. The client decides when to render it, where to drop it, how to compose it with local state, and whether to swap it out later.

The seam is placed by the _client_. The server just says, "here is some rendered UI shaped for this region." The client decides what to do with it.

That is the symmetry:

<figure>
  <img src="/blog-assets/who-owns-the-tree-rsc-is-a-protocol-not-an-architecture/two_inversions_rsc.svg" alt="The two RSC composition models: server-owned trees use client boundaries for interactivity, while client-owned trees use server-rendered slots for server regions." />
  <figcaption>The two RSC composition models differ in which side owns the tree and which side fills regions of it.</figcaption>
</figure>

| Standard RSC Model                           | Composite Components Model                    |
| -------------------------------------------- | --------------------------------------------- |
| Server owns the tree                         | Client owns the tree                          |
| Client fills interactive holes               | Server fills rendered slots                   |
| `'use client'` marks client regions          | `<CompositeComponent>` renders server regions |
| Best for server-shaped routes                | Best for client-shaped applications           |
| The client hydrates what the server composed | The client composes what the server rendered  |

Server-owned RSC answers one question:

> The server has the tree. How do I get interactivity into it?

Client-owned RSC answers the inverse:

> The client has the tree. How do I get server-rendered content into it?

They solve different problems. They are not substitutes.

## Both models can reach the extremes

There is a fun symmetry here: both models can reach the _opposite_ extreme.

Server-owned model? Push `'use client'` high enough in the tree and the route effectively becomes an SPA. The server still owns the outer entry, but everything below the boundary is client-composed.

Client-owned model? Render a server component high enough and the route behaves like a server-rendered page. The client still receives and composes the result, but the server is doing essentially all the work.

So the real distinction is not which model can technically reach which outcome. Both can.

The distinction is which side the framework _naturally pulls you toward_, and how much friction you hit when you move the other direction.

The client is the final destination of the UI. That makes the more powerful default a client-owned composition model with strong server composition primitives. It keeps the app rooted where the user experience actually runs while still letting you do server-rendered regions, server-only computation, streaming, caching, and progressive enhancement wherever they make sense.

The win isn't choosing client over server. The win is not getting locked onto one side of the line in the first place.

## Why most frameworks only ship half

The standard RSC model assumes server-owned trees, so the primitives are designed around that direction. `'use client'`, hydration boundaries, streaming, suspense fences, manifest-driven reference resolution — all of it assumes the server is composing and the client is receiving.

That is fine for what those frameworks were built for.

It's also why those frameworks don't have a great answer when you ask:

> How do I render this server fragment inside a client tree I'm already composing?

The closest answer is usually "make the client thing a `'use client'` boundary inside a server tree." That works when the route is server-shaped. When the route is _client-shaped_, you're inverting the entire architecture for what is structurally a small request.

Composite Components fill that gap. A server function returns a rendered React fragment as Flight data. The client passes it to `<CompositeComponent>` and provides slots through `children` or render props. The server-rendered fragment can position those slots, but the client still owns the surrounding tree.

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

This is _additive_. Start still supports `'use client'` when you want server-owned composition. Composite Components expose the inverse. A single app can use either, both, or neither — per route, per component, per use case.

This is not even foreign to React's original framing. The first Server Components RFC describes Client Components as the regular components you already know, and notes that Server Components can pass other Server Components _as children_ to Client Components. From the Client Component's perspective, that child is already rendered output. The same RFC also describes granular refetching from explicitly chosen entry points as part of the design direction, even though the initial demo refetched the whole app.

So the inverse model isn't a rejection of RSC. It is closer to taking the protocol seriously and exposing a composition direction the protocol already makes possible.

## What this means for "RSC support"

The phrase "RSC support" has been doing too much work.

When most frameworks say it, they mean "we support the standard server-owned model." That is a reasonable thing to mean, and the standard model covers a lot of cases.

But the protocol is bigger than the conventional architecture. That doesn't mean RSC is _just_ serialization — there are real architectural best practices around waterfalls, bundling, streaming, and invalidation. The point is narrower: the conventional server-owned application model is not the only architecture the protocol can support.

A framework can support the RSC protocol while exposing different composition models on top of it. Whether that counts as "RSC support" depends on whether you mean the protocol or one specific architecture built on it.

The cleaner framing is this:

**RSC is a protocol with multiple valid composition models.**

Server-owned is one. Client-owned is another. Both use the same Flight format, the same renderer, the same reference machinery. They differ in who owns the tree and where the seams sit.

## A powerful primitive, not the whole pipeline

This is where the conversation tends to get distorted.

RSC isn't _just_ a serialization format. It's also React's attempt to bring data fetching, streaming, code splitting, server access, and client interactivity into one coherent component model.

That is a worthy goal.

But it is still _one way_ to organize those concerns.

Routing solves waterfalls. Loaders start data work before render. Query libraries cache, dedupe, prefetch, stream, invalidate, and coordinate server state. HTTP caches responses. CDNs cache fragments. Server functions expose backend work without forcing the route tree to become server-owned.

So the question isn't whether RSC can solve these problems. It can.

The question is whether solving them through a rigid RSC architecture should be the **default answer for every application**.

Start's position is different: RSC is a powerful primitive in the pipeline, not the pipeline itself.

Use RSC where rendered server UI is the right abstraction. Use routing, loaders, query caches, server functions, HTTP, and client state where those are the better abstractions. Stop treating RSC as the coupon code that fixes all of them at once.

This is intentional. Start doesn't reject RSC. It rejects making RSC the organizing principle for problems that are often better solved by smaller, more composable tools.

The point isn't to avoid RSC. The point is to avoid turning RSC into a silver bullet.

That same distinction explains how Start handles caching.

## Why Start doesn't ship a caching directive

People keep asking why Start doesn't ship something like Next's `"use cache"`.

Short answer: `"use cache"` assumes a framework- or platform-owned persistence layer.

The directive marks a function or component as cacheable. The runtime handles serialization, key derivation, storage, and invalidation. Which means the framework has to own — or at least define — the persistence contract underneath it.

The directive doesn't _eliminate_ the persistence question. It relocates it. You write one line at the call site, and the platform fills in everything below it: memory, disk, database, edge storage, invalidation, durability, sharing across instances, deployment-specific behavior.

That shape works when your framework is tightly coupled to a specific platform.

Start targets Cloudflare Workers, Netlify, Vercel, Node, Bun, Railway, and any Nitro target. There's no single portable persistence layer across all of those, so there's no honest directive shape that means the same thing everywhere.

This isn't theoretical. The portability story for Next caching outside Vercel has already been a moving target — earlier OpenNext Cloudflare docs listed [Composable Caching](https://opennext.js.org/cloudflare/former-releases/0.5) as unsupported until Next stabilized the feature, and current Cloudflare docs list [Composable Caching](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) as supported but still experimental.

Start takes the more transparent route.

A page can render its stable regions normally and pull one expensive region as a separate RSC fragment. That fragment gets its own HTTP cache headers, its own cache tags, its own invalidation. Update one region and you don't blow up the entire page cache.

That's the important piece: the RSC output is not trapped inside a framework-owned page cache. It is a stream of rendered UI moving through whatever cache layers your application already controls.

A server function returns a Flight stream as bytes. Those bytes can be cached at whatever layer you already own:

<figure>
  <img src="/blog-assets/who-owns-the-tree-rsc-is-a-protocol-not-an-architecture/flight_cache_pipeline.svg" alt="Flight bytes passing through cache layers: render pass, server, network, and client, with decoding at render time after each cache boundary." />
  <figcaption>Flight output stays transparent through the cache layers the application already controls.</figcaption>
</figure>

| Layer       | Cache option                                              |
| ----------- | --------------------------------------------------------- |
| Render pass | `React.cache` to dedupe calls within a render             |
| Server      | Redis, KV, Postgres, in-memory LRU, or whatever you use   |
| Network     | HTTP caching and `Cache-Control` headers                  |
| Client      | Router cache, TanStack Query, or any client-side store    |

`createFromReadableStream` decodes those bytes at render time, after the cache boundary. So the cacheable primitive isn't a directive that hides persistence. It is transparent RSC output flowing through standard cache layers.

This isn't a worse `"use cache"`. It is a different architectural choice.

The directive shape is right when the framework and platform can own the cache contract. The transparent-bytes shape is right when the framework needs to stay portable across runtimes.

## When to reach for which

Inside a Start app, the practical guidance is straightforward.

**Server-owned RSC, when the route is server-shaped.** Docs, blog posts, marketing pages, SEO-driven content — anything where the tree shape is mostly a function of server data. The server owns the page. Add `'use client'` where you need interactivity.

**Composite Components, when the route is client-shaped.** Dashboards, builders, admin tools, editors, previews, data-rich product surfaces. The client owns layout, state, navigation, and interaction. The server contributes rendered regions where they actually help.

**Both, when the app has different shapes in different places.** Marketing routes can be server-owned. Dashboard routes can be client-owned. A docs page can use server-owned RSC while an interactive playground in the same app uses Composite Components. You don't have to commit to one architecture up front.

**Neither, when RSC isn't the right tool.** Plenty of routes don't need RSC at all, and Start doesn't make them pay for it. Fully client-side routes, static routes, simple server-data routes — keep them simple.

## Closing

The better question isn't:

> Does this framework support RSC?

It's:

> Which RSC composition models does it expose?

TanStack Start supports the standard server-owned model when that's the right fit. It also exposes the inverse: client-owned trees that compose server-rendered fragments as data. Both use the same RSC protocol. They just place ownership, composition, and caching seams in different parts of the system.

RSC is a powerful protocol. It is a powerful primitive. It is not, by itself, an application architecture — and a framework's job is to let you compose it with everything else, the way **you** know your app needs it.

Same TanStack philosophy as always. You know what's best for your application. The framework should get out of the way.

## Further reading

This post was partly prompted by Viktor Lázár's [RSC as a serializer, not a model](https://dev.to/lazarv/rsc-as-a-serializer-not-a-model-56nj), which argues that TanStack Start exposes RSC more as a serializer than as the conventional RSC application model.

Daishi Kato's [My Thoughts on RSC: Is It Just Serialization?](https://newsletter.daishikato.com/p/my-thoughts-on-rsc-is-it-just-serialization) is worth reading as a contrast. I agree with the narrower point — RSC is _not_ merely serialization. Where I push back is the broader implication that RSC's architectural best practices should pull a framework toward a server-owned application model.

My position is that RSC is a powerful protocol and a powerful primitive, but not a complete application architecture by itself. The framework around it should still be free to compose it with routing, loaders, query caches, server functions, HTTP caching, client state, and the rest of the ecosystem — instead of letting RSC become the organizing abstraction for the whole app.

---

If you've been waiting for an RSC story that doesn't ask you to invert your whole architecture, this is it. RSC support in TanStack Start is [experimental and ready to play with](/start/latest/docs/framework/react/guide/server-components).

Let's build something amazing together.
