---
title: RSC Is a Protocol Before It Is an Architecture
published: 2026-04-28
draft: true
excerpt: RSC is usually framed as a single architecture where the server owns the tree. But it is also a protocol, and the protocol supports more than one composition model. The overlooked question is who owns the tree.
authors:
  - Tanner Linsley
---

React Server Components are usually discussed as if they describe one architecture: the server owns the tree, client boundaries are marked with `use client`, and the framework stitches everything together during hydration.

That model is real and important.

But it is not the whole of RSC.

RSC is also a protocol: a way to serialize rendered React output, client references, and non JSON values into a stream that can be sent over the wire and reconstructed elsewhere. The server owned tree model is one way to use that protocol. It is not the only way.

The overlooked question is simpler:

**Who owns the tree?**

If the server owns the tree, you need a way to insert client interactivity into it. That is the standard `use client` model.

If the client owns the tree, you need a way to insert server rendered content into it. That is the model Composite Components expose in TanStack Start.

## Why This Matters

Imagine a dashboard where the client owns tabs, filters, drag layout, optimistic state, and local interactions, but one expensive chart should be rendered on the server. The chart pulls from a slow analytics API, runs server-only computation, and would ship hundreds of kilobytes of charting library to the client if rendered there.

In the standard RSC model, the natural answer is to move the dashboard into a server owned tree, then mark the interactive pieces with `use client`. That can work, but it also asks the application to adopt a server first architecture just to render one server shaped region.

Composite Components solve the inverse problem. The dashboard stays client owned. The chart can be requested from the server as rendered RSC output. The client receives it as data, places it where it wants, composes it with local state, and decides when to replace it. If the server rendered chart contains no interactive client regions, the client does not have to fetch a client chunk for that region at all.

That is not a workaround for RSC. It is another valid way to use the RSC protocol.

## The Real Question: Who Owns the Tree?

Composing UI across a network boundary is fundamentally an ownership problem. One side owns the tree. The other side fills regions of it.

The important question is which side decides what goes where.

### Server Owned Trees

In the standard RSC model, the server owns the tree. The developer writes server components, marks the parts that need interactivity with `use client`, and the framework handles the rest.

At hydration, the client receives the rendered tree along with a manifest mapping client references to actual client component modules. The framework resolves those references and hydrates the interactive regions.

The seam is placed by the server. The server says, "this part of the tree is interactive, and this client component fills it."

The client receives a tree it did not compose. It hydrates what arrived.

This is the model Next.js App Router builds its architecture around. It is coherent and well suited when the server is the natural owner of the page: content heavy routes, server rendered shells, SEO driven pages, and routes where the tree shape is mostly a function of server data.

### Client Owned Trees

The inverse model is less discussed because most frameworks do not expose a primitive for it.

What if the client owns the tree, and the server fills server shaped regions on request?

This is the natural shape of many applications: dashboards, builders, admin tools, editors, data apps, and highly interactive product surfaces where routing, layout, and interactivity live primarily on the client.

In this model, the developer writes a client tree as normal. Where they need server rendered content, they leave a slot. The server renders content that fits that slot and ships it as data. The client decides when to render it, where to place it, how to compose it with local state, and whether to replace it with something else.

The seam is placed by the client. The server says, "here is rendered content shaped for this region." The client decides what to do with it.

This is the symmetry:

<figure>
  <img src="/blog-assets/rsc-is-a-protocol-before-it-is-an-architecture/two_inversions_rsc.svg" alt="The two RSC composition models: server owned trees use client boundaries for interactivity, while client owned trees use server rendered slots for server regions." />
  <figcaption>The two RSC composition models differ in which side owns the tree and which side fills regions of it.</figcaption>
</figure>

| Standard RSC Model                           | Composite Components Model                    |
| -------------------------------------------- | --------------------------------------------- |
| Server owns the tree                         | Client owns the tree                          |
| Client fills interactive holes               | Server fills rendered slots                   |
| `use client` marks client regions            | `<CompositeComponent>` renders server regions |
| Best for server shaped routes                | Best for client shaped applications           |
| The client hydrates what the server composed | The client composes what the server rendered  |

Server owned RSC answers one question:

> The server has the tree. How do I get interactivity into it?

Client owned RSC answers the inverse question:

> The client has the tree. How do I get server rendered content into it?

They solve different problems. They are not substitutes.

## Both Models Can Reach the Extremes

There is another interesting symmetry here: both models can reach the opposite extreme.

In a server owned model, you can put `use client` high enough in the tree and effectively turn the route into an SPA. The server still owns the outer entry point, but most of the application becomes client composed from that boundary downward.

In a client owned model, you can do the inverse. You can render a server component high enough in the tree and let the server do almost all of the work for that page. The client still receives and composes the result, but the route can behave very much like a server rendered page.

So the real distinction is not which model can technically reach which outcome. Both can.

The distinction is which side the framework naturally pulls you toward, and how much friction there is when you move back and forth.

Because the client is the final destination of the UI, the more powerful default is a client owned composition model with strong server composition primitives. It lets the application stay rooted where the user experience ultimately runs, while still allowing server rendered regions, server only computation, streaming, caching, and progressive enhancement wherever they make sense.

The win is not choosing client over server. The win is avoiding a framework model that makes one side the permanent owner of the whole application.

## Why Most Frameworks Only Ship Half

The standard RSC model assumes server owned trees, so the primitives are designed around that direction.

`use client` is the primitive for the server owned direction. Hydration boundaries, streaming, suspense fences, and manifest driven reference resolution all assume the server is composing and the client is receiving.

That is fine for the cases the model was designed for.

It is also why those frameworks do not have an obvious answer when a developer asks:

> How do I render this server fragment inside a client tree I am composing?

The closest answer is usually to make the client thing a `use client` boundary inside a server tree. That works when the route is server shaped. But when the route is client shaped, it inverts the whole architecture for what is structurally a small request.

Composite Components fill that gap in TanStack Start.

A server function returns a rendered React fragment as Flight data, the serialized stream format used by RSC. The client passes that output to a `<CompositeComponent>` and provides slots through `children` or render props. The server rendered fragment can position those slots, but the client still owns the surrounding tree.

This is additive. Start supports the standard `use client` model when the developer wants server owned composition. Composite Components expose the inverse model when the developer wants client owned composition.

A single application can use either, both, or neither, depending on which model fits each route.

This model is not completely foreign to React's original framing either. The original Server Components RFC describes Client Components as the standard React components developers already know, and notes that a Server Component can pass another Server Component as a child to a Client Component. From the Client Component's perspective, that child is already rendered output. The same RFC also describes granular refetching from explicitly chosen entry points as part of the design direction, even though the initial demo refetched the whole app.

So the inverse model is not a rejection of RSC. It is closer to taking the protocol seriously and exposing a composition direction that the protocol already makes possible.

## What This Means for "RSC Support"

The phrase "RSC support" has been doing too much work.

Frameworks often mean, "we support the standard server owned model." That is a reasonable thing to mean. The standard model covers many cases.

But the protocol is bigger than the conventional model.

That does not mean RSC is just serialization. The protocol exists to enable a composition story between environments, and there are real architectural best practices around waterfalls, bundling, streaming, and invalidation. The point is narrower: the conventional server owned application model is not the only architecture the protocol can support.

A framework can support the RSC protocol while exposing different composition models on top of it. Whether that counts as "RSC support" depends on whether you mean the protocol or one specific architecture built with it.

The more precise framing is this:

**RSC is a protocol with multiple valid composition models.**

The server owned model is one. The client owned model is another.

Both use the same Flight format, the same renderer, and the same reference machinery. They differ in who owns the tree and where the composition seams are placed.

## A Powerful Primitive, Not the Whole Pipeline

This is where the discussion can get distorted.

RSC is not merely a serialization format. It is also React's attempt to bring data fetching, streaming, code splitting, server access, and client interactivity into one coherent component model.

That is a worthy goal.

But it is still one way to organize those concerns.

Routing can solve waterfalls. Loaders can start data work before render. Query libraries can cache, dedupe, prefetch, stream, invalidate, and coordinate server state. HTTP can cache responses. CDNs can cache fragments. Server functions can expose backend work without forcing the route tree to become server owned.

So the question is not whether RSC can solve these problems. It can.

The question is whether solving them through a rigid RSC architecture should be the default answer for every application.

Start's position is different: RSC is a powerful primitive in the pipeline, not the pipeline itself.

Use RSC where rendered server UI is the right abstraction. Use routing, loaders, query caches, server functions, HTTP, and client state where those are the better abstractions.

This is an intentional design choice. Start does not reject RSC. It rejects making RSC the organizing principle for problems that are often better solved by smaller, more composable tools.

The point is not to avoid RSC. The point is to avoid turning RSC into a silver bullet.

This same distinction also explains Start's approach to caching.

## Why Start Does Not Ship a Caching Directive

Why does TanStack Start not ship a directive like Next's `"use cache"`?

The short answer is that `"use cache"` assumes a framework or platform owned persistence layer.

The directive marks a function or component as cacheable. The runtime handles serialization, key derivation, storage, and invalidation. That means the framework has to own, or at least define, the persistence contract underneath it.

The directive does not eliminate the persistence question. It relocates it.

The developer writes one line at the call site, and the platform fills in everything below it: memory, disk, database, edge storage, invalidation, durability, sharing across instances, and deployment specific behavior.

That shape makes sense for frameworks tightly coupled to a platform.

TanStack Start targets Cloudflare Workers, Netlify, Vercel, Node, Bun, Railway, and any Nitro target. There is no single portable persistence layer across all of those environments, so there is no directive shape that honestly means the same thing everywhere.

This is not theoretical. The portability story for Next caching outside Vercel has already been a moving target. Earlier OpenNext Cloudflare docs listed [Composable Caching](https://opennext.js.org/cloudflare/former-releases/0.5) as unsupported until Next stabilized the feature, while current Cloudflare docs list [Composable Caching](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) as supported but still experimental.

Start takes the more transparent route.

A concrete example is partial page caching.

A page can render its stable regions normally, while one expensive or frequently changing region is fetched as a separate RSC fragment. That fragment can have its own HTTP cache headers, its own cache tags, and its own invalidation behavior. Updating that region does not require invalidating the entire page.

That is the important distinction: the RSC output is not trapped inside a framework owned page cache. It is a stream of rendered UI that can move through the same cache layers as any other HTTP response.

A server function can return a Flight stream as bytes. Those bytes can be cached at whatever layer the application already owns:

<figure>
  <img src="/blog-assets/rsc-is-a-protocol-before-it-is-an-architecture/flight_cache_pipeline.svg" alt="Flight bytes passing through cache layers: render pass, server, network, and client, with decoding at render time after each cache boundary." />
  <figcaption>Flight output can remain transparent through the cache layers the application already controls.</figcaption>
</figure>

| Layer       | Cache option                                               |
| ----------- | ---------------------------------------------------------- |
| Render pass | `React.cache` can dedupe calls within a render             |
| Server      | Redis, KV, Postgres, in memory LRU, or any app owned store |
| Network     | HTTP caching and `Cache-Control` headers                   |
| Client      | Router cache, TanStack Query, or any client side store     |

`createFromReadableStream` decodes the bytes at render time, after the cache boundary.

So the cacheable primitive is not a directive that hides persistence. It is transparent RSC output moving through standard cache layers.

This is not a worse version of `"use cache"`. It is a different architectural choice.

The directive shape is right when the framework and platform can own the cache contract. The transparent bytes shape is right when the framework needs to stay portable across runtimes.

## When to Reach for Which

Within a TanStack Start application, the practical guidance is straightforward.

### Use the standard server owned model when the route is server shaped

Docs pages, blog posts, marketing pages, SEO driven content, and routes where the tree structure is mostly a function of server data are good fits for the standard RSC model.

The server owns the page. Interactivity is added where needed with `use client`.

### Use Composite Components when the route is client shaped

Dashboards, builders, admin tools, editors, previews, and data rich product surfaces are often client shaped.

The client owns layout, state, navigation, and interaction. The server contributes rendered regions where that makes sense.

### Use both when different parts of the app have different shapes

A marketing route might be server owned. A dashboard route might be client owned. A docs page might use server owned RSC, while an interactive playground inside the same app uses Composite Components.

The framework does not require one architectural commitment up front.

### Use neither when RSC is not the right tool

Many routes do not need RSC at all, and Start does not force them to pay for it. Fully client side routes, static routes, and simple server data routes can stay simple.

## Closing

So the better question is not:

> Does this framework support RSC?

The better question is:

> Which RSC composition models does it expose?

TanStack Start supports the standard server owned model when that is the right fit. It also exposes the inverse model: client owned trees that can compose server rendered fragments as data.

Both use the same underlying RSC protocol. They simply place ownership, composition, and caching seams in different parts of the system.

RSC is a powerful protocol and a powerful primitive. It is not, by itself, an application architecture, and a framework's job is to let you compose it with everything else.

## Further Reading

This post was partly prompted by Viktor Lázár's post <a href="https://dev.to/lazarv/rsc-as-a-serializer-not-a-model-56nj" rel="nofollow noopener noreferrer">RSC as a serializer, not a model</a>, which argues that TanStack Start exposes RSC more as a serializer than as the conventional RSC application model.

Daishi Kato's <a href="https://newsletter.daishikato.com/p/my-thoughts-on-rsc-is-it-just-serialization" rel="nofollow noopener noreferrer">My Thoughts on RSC: Is It Just Serialization?</a> is worth reading as a contrast. I agree with the narrower point that RSC is not merely serialization. But I disagree with the broader implication that RSC's architectural best practices should necessarily pull a framework toward a server owned application model.

My position is that RSC is a powerful protocol and a powerful primitive, but not a complete application architecture by itself. The surrounding framework should still be free to compose it with routing, loaders, query caches, server functions, HTTP caching, client state, and other ecosystem primitives instead of allowing RSC to become the organizing abstraction for the entire application.
