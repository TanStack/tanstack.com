---
published: 2026-03-15
authors:
  - Florian Pellet
# title: 'How TanStack Router Became Granularly Reactive'
# title: 'TanStack Router''s Granular Reactivity Rewrite'
# title: 'Routing Is a Graph. Now Our Reactivity Is Too.'
title: 'From One Big Router Store to a Granular Signal Graph'
excerpt: TanStack Router now uses a granular signal graph as its reactive core. State is derived from that graph, narrowing change propagation and making client-side navigation substantially faster.
---

![veins of emerald as a signal graph embedded in the rock of a tropical island](/blog-assets/tanstack-router-signal-graph/header.png)

TanStack Router used to center most of its reactivity around one large object: `router.state`. [This refactor](https://github.com/TanStack/router/pull/6704) replaces that broad store with a graph of smaller stores. `router.state` is no longer the internal source of truth. It is now derived from the store graph.

This builds on TanStack Store's migration to [alien-signals](https://github.com/stackblitz/alien-signals) in [TanStack Store PR #265](https://github.com/TanStack/store/pull/265), implemented by [@DavidKPiano](https://github.com/davidkpiano). In external benchmarks like [js-reactivity-benchmark](https://github.com/transitive-bullshit/js-reactivity-benchmark), alien-signals is currently the best-performing signals implementation tested. But the main improvement here is not just a faster primitive. It is a different reactive model.

The result is

- better update locality,
- fewer store updates during navigation,
- substantially faster client-side navigation,
- and Solid can now use its native signals.

## Old Model: One Broad Router State

The old model had one main reactive surface: `router.state`.

That was useful. It made it possible to prototype features quickly and ship a broad API surface without first designing a perfect internal reactive topology. But it also meant many different concerns shared the same reactive entry point.

| Concern           | Stored under `router.state`                  | Typical consumer                 |
| ----------------- | -------------------------------------------- | -------------------------------- |
| Location          | `location`, `resolvedLocation`               | `useLocation`, `Link`            |
| Match lifecycle   | `matches`, `pendingMatches`, `cachedMatches` | `useMatch`, `Matches`, `Outlet`  |
| Navigation status | `status`, `isLoading`, `isTransitioning`     | pending UI, transitions          |
| Side effects      | `redirect`, `statusCode`                     | navigation and response handling |

This did not mean every update rerendered everything. Options like `select` and `structuralSharing` could prevent propagation. But many consumers still started from a broader subscription surface than they actually needed.

## Problem: Routing State Has Locality

Routing is not one thing that changes all at once. A navigation changes specific pieces of state with specific relationships: one match stays active, another becomes pending, one link flips state, some cached matches do not change at all.

The old model captured those pieces of state, but it flattened them into one main subscription surface. This is where the mismatch becomes visible:

<figure>
<video src="/blog-assets/tanstack-router-signal-graph/before-granular-store-graph-2.mp4" playsinline loop autoplay muted></video>
<figcaption>
A video showing that on every stateful event in the core of the router, changes are propagated to every subscription across the entire application.
</figcaption>
</figure>

The point is that `router.state` was broader than what many consumers actually needed.

## New Model: The Graph Becomes the Source of Truth

The new model is not just "more stores". It inverts the relationship between `router.state` and the reactive graph.

The broad surface is split into smaller stores with narrower responsibilities.

- **top-level stores** for location, status, loading, transitions, redirects, and similar scalar state
- **per-match stores** grouped into pools of active matches, pending matches, and cached matches.
- **derived stores** for specific purposes like "is any match pending"

`router.state` still exists as a compatibility snapshot for public APIs. It is just no longer the primary model that everything else hangs off.

The new picture looks like this:

<figure>
<video src="/blog-assets/tanstack-router-signal-graph/after-granular-store-graph-2.mp4" playsinline loop autoplay muted></video>
<figcaption>
A video showing that on each stateful event in the core of the router, only a specific subset of subscribers are updated in the application.
</figcaption>
</figure>

> [!NOTE]
> Active, pending, and cached matches are now modeled separately because
> they have different lifecycles. This reduces state propagation even further.

Before, the graph was derived from `router.state`. Now, `router.state` is derived from the graph. That inversion is the refactor.

## Hook-Level Change: Subscribe to the Relevant Store

Once the graph becomes the source of truth, hooks can subscribe directly to graph nodes instead of selecting from a broad snapshot. The clearest example is `useMatch`.

Before this refactor, `useMatch` subscribed through the big router store and then searched `state.matches` for the match it cared about. Now it resolves the relevant store first and subscribes directly to it.

```ts
// Before
useRouterState({
  select: (state) => {
    const match = state.matches.find((m) => m.routeId === routeId)
    return /* select from one match */
  }
})

// After
const matchStore = router.stores.getMatchStoreByRouteId(routeId)
useStore(matchStore, (match) => /* select from one match */)
```

> [!NOTE]
> `getMatchStoreByRouteId` creates a derived signal on demand, and stores it
> in a Least-Recently-Used cache so it can be reused by other subscribers
> without leaking memory.

The store-update-count graphs below show how many times subscriptions are invoked during various routing scenarios, before (curve is the entire history) and after (last point is this refactor).

<!-- ::start:tabs -->

#### React

<figure>
<img src="/blog-assets/tanstack-router-signal-graph/store-updates-history-react.png" alt="A graph showing the number of times a useRouterState subscription is triggered in various test scenarios, going from a 5 to 18 range down to a 0 to 8 range">
<figcaption>
Absolute counts are not directly comparable across frameworks, because React, Solid, and Vue do not propagate updates in exactly the same way.
</figcaption>
</figure>

#### Solid

<figure>
<img src="/blog-assets/tanstack-router-signal-graph/store-updates-history-solid.png" alt="A graph showing the number of times a useRouterState subscription is triggered in various test scenarios, going from a 3 to 19 range down to a 0 to 8 range">
<figcaption>
Absolute counts are not directly comparable across frameworks, because React, Solid, and Vue do not propagate updates in exactly the same way.
</figcaption>
</figure>

#### Vue

<figure>
<img src="/blog-assets/tanstack-router-signal-graph/store-updates-history-vue.png" alt="A graph showing the number of times a useRouterState subscription is triggered in various test scenarios, going from a 6 to 46 range down to a 2 to 16 range">
<figcaption>
Absolute counts are not directly comparable across frameworks, because React, Solid, and Vue do not propagate updates in exactly the same way.
</figcaption>
</figure>

<!-- ::end:tabs -->

These graphs are the most direct proof that change propagation got narrower.

## Store Boundary: One Contract, Multiple Implementations

The refactor did not only split router state into smaller stores. It also moved the store implementation behind a contract.

The core now defines what a router store must do. Each adapter provides the implementation.

```ts
export interface RouterReadableStore<TValue> {
  readonly state: TValue
}

export interface RouterWritableStore<TValue> {
  readonly state: TValue
  setState: (updater: (prev: TValue) => TValue) => void
}

export type StoreConfig = {
  createMutableStore: MutableStoreFactory
  createReadonlyStore: ReadonlyStoreFactory
  batch: RouterBatchFn
  init?: (stores: RouterStores<AnyRoute>) => void
}
```

| Adapter | Store implementation |
| :------ | :------------------- |
| React   | TanStack Store       |
| Vue     | TanStack Store       |
| Solid   | Solid signals        |

This keeps one router core while letting each adapter plug in the store model it wants.

> [!NOTE]
> Solid's derived stores are backed by native memos, and the adapter uses a `FinalizationRegistry`
> to dispose detached roots when those stores are garbage-collected.

## Observable Result: Less Work During Navigation

No new public API is required here. `useMatch`, `useLocation`, and `<Link>` keep the same surface. The difference is that navigation and preload flows now wake up fewer subscriptions.

Our benchmarks isolate client-side navigation cost on a synthetic rerender-heavy page.

- React: `7ms -> 4.5ms`
- Solid: `12ms -> 8ms`
- Vue: `7.5ms -> 6ms`

<!-- ::start:tabs -->

#### React

<figure>
<img src="/blog-assets/tanstack-router-signal-graph/client-side-nav-react.png" alt="">
<figcaption>
This graph shows the duration of 10 navigations on <code>main</code> (grey) and on <code>refactor-signals</code> (blue).
</figcaption>
</figure>

#### Solid

<figure>
<img src="/blog-assets/tanstack-router-signal-graph/client-side-nav-solid.png" alt="">
<figcaption>
This graph shows the duration of 10 navigations on <code>main</code> (grey) and on <code>refactor-signals</code> (blue).
</figcaption>
</figure>

#### Vue

<figure>
<img src="/blog-assets/tanstack-router-signal-graph/client-side-nav-vue.png" alt="">
<figcaption>
This graph shows the duration of 10 navigations on <code>main</code> (grey) and on <code>refactor-signals</code> (blue).
</figcaption>
</figure>

<!-- ::end:tabs -->

There is also a bundle-size tradeoff. In our synthetic bundle-size benchmarks, measuring gzipped sizes:

- ↗ React increased by `~1KiB`
- ↗ Vue increased by `~1KiB`
- ↘ Solid decreased by `~1KiB`

<!-- ::start:tabs -->

#### React

<figure>
<img src="/blog-assets/tanstack-router-signal-graph/bundle-size-history-react.png" alt="A graph of the history of the bundle size of a synthetic tanstack/react-router app, gaining 1KiB gzipped with this latest change">
<figcaption>
Only relative changes matter in this benchmark, they are based on arbitrary apps and absolute sizes are not representative.
</figcaption>
</figure>

#### Solid

<figure>
<img src="/blog-assets/tanstack-router-signal-graph/bundle-size-history-solid.png" alt="A graph of the history of the bundle size of a synthetic tanstack/solid-router app, shedding 1KiB gzipped with this latest change">
<figcaption>
Only relative changes matter in this benchmark, they are based on arbitrary apps and absolute sizes are not representative.
</figcaption>
</figure>

#### Vue

<figure>
<img src="/blog-assets/tanstack-router-signal-graph/bundle-size-history-vue.png" alt="A graph of the history of the bundle size of a synthetic tanstack/vue-router app, gaining 1KiB gzipped with this latest change">
<figcaption>
Only relative changes matter in this benchmark, they are based on arbitrary apps and absolute sizes are not representative.
</figcaption>
</figure>

<!-- ::end:tabs -->

## Closing

This refactor did not just add signals to the old model. It inverted the reactivity model.

Before, `router.state` was the broad reactive surface and the graph was derived from it. Now the graph is the primary model, and `router.state` is a compatibility snapshot derived from the graph.

Routing is a graph. Now the reactivity is one too.
