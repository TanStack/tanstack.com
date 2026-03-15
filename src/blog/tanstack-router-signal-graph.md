---
published: 2026-03-15
authors:
  - Florian Pellet
# title: 'How TanStack Router Became Granularly Reactive'
# title: 'TanStack Router''s Granular Reactivity Rewrite'
# title: 'Routing Is a Graph. Now Our Reactivity Is Too.'
title: 'From One Big Router Store to a Granular Signal Graph'
---

![veins of emerald as a signal graph embedded in the rock of a tropical island](/blog-assets/tanstack-router-signal-graph/header.png)

TanStack Router used to center most of its reactivity around one large object: `router.state`. [This refactor](https://github.com/TanStack/router/pull/6704) replaces that broad store with a graph of smaller stores.

This builds on TanStack Store's migration to [alien-signals](https://github.com/stackblitz/alien-signals) in [TanStack Store PR #265](https://github.com/TanStack/store/pull/265), implemented by [@DavidKPiano](https://github.com/davidkpiano). In external benchmarks like [js-reactivity-benchmark](https://github.com/transitive-bullshit/js-reactivity-benchmark), alien-signals is currently the best-performing signals implementation tested. But the main improvement here is not just a faster primitive. It is a different reactive model.

The result is better update locality, fewer store updates during navigation, substantially faster client-side navigation, and Solid can now use its native signals.

## Old Model: One Broad Router State

The old model had one main reactive surface: `router.state`.

That was useful. It made it possible to prototype features quickly and ship a broad API surface without first designing a perfect internal reactive topology. But it also meant many different concerns shared the same reactive entry point.

| Concern              | Stored under `router.state`                  | Typical consumer                 |
| -------------------- | -------------------------------------------- | -------------------------------- |
| Location             | `location`, `resolvedLocation`               | `useLocation`, `Link`            |
| Match lifecycle      | `matches`, `pendingMatches`, `cachedMatches` | `useMatch`, `Matches`, `Outlet`  |
| Navigation status    | `status`, `isLoading`, `isTransitioning`     | pending UI, transitions          |
| Routing side effects | `redirect`, `statusCode`                     | navigation and response handling |

This did not mean every update rerendered everything. Options like `select` and `structuralSharing` could prevent propagation. But many consumers still started from a broader subscription surface than they actually needed.

## Problem: Routing State Has Locality

Routing is not one thing that changes all at once. A navigation changes specific pieces of state with specific relationships: one match stays active, another becomes pending, one link flips state, some cached matches do not change at all.

The old model captured those pieces of state, but it flattened them into one main subscription surface. That was the mismatch.

This is where the mismatch becomes visible:

<figure>
<video src="/blog-assets/tanstack-router-signal-graph/before-router-state-blob.mp4" playsinline loop autoplay muted></video>
<figcaption>
A video showing that on every stateful event in the core of the router, changes are propagated to every subscription across the entire application.
</figcaption>
</figure>

The point is that `router.state` was broader than what many consumers actually needed.

## New Model: Split Router State into Stores

The new model breaks that broad surface into smaller stores with narrower responsibilities.

- top-level stores for location, status, loading, transitions, redirects, and similar scalar state
- separate pools for active matches, pending matches, and cached matches
- per-match stores inside each pool
- derived stores for route-level lookups such as "the current active match for route X"

`router.state` still exists as a compatibility view for public APIs. It is just no longer the primary model that everything else hangs off.

The new picture looks like this:

<figure>
<video src="/blog-assets/tanstack-router-signal-graph/after-granular-store-graph.mp4" playsinline loop autoplay muted></video>
<figcaption>
A video showing that on stateful event in the core of the router, only specific subset of subscribers are updated in the application.
</figcaption>
</figure>

The important change is simple: the compatibility snapshot is now derived from the graph, instead of the graph being derived from the snapshot.

## Hook-Level Change: Subscribe to the Relevant Store

The clearest example is `useMatch`.

Before this refactor, `useMatch` subscribed through the big router store and then searched `state.matches` for the match it cared about. Now it resolves the relevant store first and subscribes directly to it.

```ts
// Before
useRouterState({
  select: (state) => state.matches.find(/* route or match lookup */),
})

// After
const matchStore = router.stores.getMatchStoreByRouteId(routeId)
useStore(matchStore, (match) => /* select from one match */)
```

The store-update-count graphs below show the before/after change within each adapter. Absolute counts are not directly comparable across frameworks, because React, Solid, and Vue do not propagate updates in exactly the same way.

<!-- ::start:tabs -->

#### React

![A graph showing the number of times a useRouterState subscription is triggered in various test scenarios, going from a 5 to 18 range down to a 0 to 8 range](/blog-assets/tanstack-router-signal-graph/store-updates-history-react.png)

#### Solid

![A graph showing the number of times a useRouterState subscription is triggered in various test scenarios, going from a 3 to 19 range down to a 0 to 8 range](/blog-assets/tanstack-router-signal-graph/store-updates-history-solid.png)

#### Vue

![A graph showing the number of times a useRouterState subscription is triggered in various test scenarios, going from a 6 to 46 range down to a 2 to 16 range](/blog-assets/tanstack-router-signal-graph/store-updates-history-vue.png)

<!-- ::end:tabs -->

These graphs are the most direct proof that change propagation got narrower.

## Store Boundary: One Contract, Multiple Implementations

The refactor did not only split router state into smaller stores. It also moved the store implementation behind a contract.

The core now defines what a router store must do. Each adapter provides the implementation.

```ts
export interface RouterReadableStore<TValue> {
  readonly state: TValue
}

export interface RouterWritableStore<
  TValue,
> extends RouterReadableStore<TValue> {
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
| Solid   | native signals       |

This keeps one router core while letting each adapter plug in the store model it wants.

## Observable Result: Less Work During Navigation

No new public API is required here. `useMatch`, `useLocation`, and `<Link>` keep the same surface. The difference is that navigation and preload flows now wake up fewer subscriptions.

The `benchmarks/client-nav` benchmarks isolate client-side navigation cost on a synthetic rerender-heavy page.

- React: `7ms -> 4.5ms`
- Solid: `12ms -> 8ms`
- Vue: `7.5ms -> 6ms`

<!-- ::start:tabs -->

#### React

![A graph showing the duration of a single navigation on a synthetic tanstack/react-router app going from about 7ms to about 4.5ms](/blog-assets/tanstack-router-signal-graph/client-side-nav-react.png)

#### Solid

![A graph showing the duration of a single navigation on a synthetic tanstack/solid-router app going from about 12ms to about 8ms](/blog-assets/tanstack-router-signal-graph/client-side-nav-solid.png)

#### Vue

![A graph showing the duration of a single navigation on a synthetic tanstack/vue-router app going from about 7.5ms to about 6ms](/blog-assets/tanstack-router-signal-graph/client-side-nav-vue.png)

<!-- ::end:tabs -->

There is also a bundle-size tradeoff. In our synthetic bundle-size benchmarks, measuring gzipped sizes:

- ↗ React increased by `~1KiB`
- ↗ Vue increased by `~1KiB`
- ↘ Solid decreased by `~1KiB`

<!-- ::start:tabs -->

#### React

![A graph the history of the bundle size of a synthetic tanstack/react-router app, gaining 1KiB gzipped with this latest change](/blog-assets/tanstack-router-signal-graph/bundle-size-history-react.png)

#### Solid

![A graph the history of the bundle size of a synthetic tanstack/solid-router app, shedding 1KiB gzipped with this latest change](/blog-assets/tanstack-router-signal-graph/bundle-size-history-solid.png)

#### Vue

![A graph the history of the bundle size of a synthetic tanstack/vue-router app, gaining 1KiB gzipped with this latest change](/blog-assets/tanstack-router-signal-graph/bundle-size-history-vue.png)

<!-- ::end:tabs -->

## Closing

This refactor did not just add signals to the old model. It also changed the reactive model itself.

The old model organized most reactivity around one broad router state. The new model organizes it around a graph of smaller stores with narrower update paths.

Routing is a graph. Now the reactivity is one too.
