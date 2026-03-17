---
published: 2026-02-01
authors:
  - Manuel Schiller
  - Florian Pellet
# title: '5x SSR Throughput: CPU profiling of TanStack Start SSR under heavy load'
# title: 'Profile, Fix, Repeat: 5x SSR Throughput in 20 PRs'
# title: '10x Latency Reduction in 20 PRs'
# title: '10x Latency Drop: SSR Flamegraphs under heavy load'
title: '5x SSR Throughput: Profiling SSR Hot Paths in TanStack Start'
---

![A flamegraph island in the tanstack universe](/blog-assets/tanstack-start-5x-ssr-throughput/header.png)

## TL;DR

We improved TanStack Start's SSR performance dramatically. Under sustained load (using our `links-100` stress benchmark with 100 concurrent connections, 30 seconds):

- **Throughput**: 427 req/s → 2357 req/s (**5.5x**)
- **Average latency**: 424ms → 43ms (**9.9x faster**)
- **p99 latency**: 6558ms → 928ms (**7.1x faster**)
- **Success rate**: 99.96% → 100% (the server stopped failing under load)

For SSR-heavy deployments, this translates directly to lower hosting costs, the ability to handle traffic spikes without scaling, and eliminating user-facing errors.

This work started after `v1.154.4` and targets server-side rendering performance. The goal was to increase throughput and reduce server CPU time per request.

We did it with a repeatable process, not a single clever trick:

- **Measure under load**, not in microbenchmarks.
- Use **CPU profiling** to find the highest-impact work.
- Remove **entire categories of cost** from the server hot path.

We highlight the highest-impact patterns below:

- avoid `URL` construction/parsing when it is not required
- avoid reactivity work during SSR (subscriptions, structural sharing, batching)
- add server-only fast paths behind a build-time `isServer` flag
- avoid `delete` in performance-sensitive code

## Methodology: feature-focused endpoints + flamegraphs

We are not claiming that any single line of code is "the" reason. This work spanned over [20 PRs](https://github.com/TanStack/router/compare/v1.154.4...v1.157.18), with still more to come. Every change was validated by:

- a stable load test (same endpoint, same load)
- a before/after comparison on the same benchmark endpoint
- a CPU profile (flamegraph) that explains the delta

### Why feature-focused endpoints

We did not benchmark "a representative app page". We used endpoints that exaggerate a feature so the profile is unambiguous:

- **`links-100`**: renders ~100 links to stress link rendering and location building.
- **`layouts-26-with-params`**: deep nesting + params to stress matching and path/param work.
- **`empty`**: minimal route to establish a baseline for framework overhead.

This is transferable: isolate the subsystem you want to improve, and benchmark that.

### Load generation with `autocannon`

We used [`autocannon`](https://github.com/mcollina/autocannon) to generate a 30s sustained load. We tracked:

- requests per second (req/s)
- latency distribution (average, p95, p99)

Example command (adjust concurrency and route):

```bash
autocannon -d 30 -c 100 --warmup [ -d 2 -c 20 ] http://localhost:3000/bench/links-100
```

### CPU profiling with `@platformatic/flame`

To record a CPU profile of the server under load, we use [`@platformatic/flame`](https://github.com/platformatic/flame) to start the server:

```sh
flame run ./dist/server.mjs
```

This gives you

- a CPU flamegraph
- a memory histogram
- and even markdown files that can be read by AI agents

To improve SSR performance, we repeated the same steps:

- Focus on **self time** first. That is where the CPU is actually spent, not just where time is waiting on children.
- Fix one hotspot, re-run, and re-profile.
- Prefer changes that remove work in the steady state, not just shift it.

### Reproducing these benchmarks

Our benchmarks were stable enough to produce very similar results on a range of setups. However, here are the exact environment details we used to run most of the benchmarks:

- Node.js: v24.12.0
- Hardware: MacBook Pro (M3 Max)
- OS: macOS 15.7

The exact benchmark code is available in [our repository](https://github.com/TanStack/router/tree/main/e2e/react-start/flamegraph-bench).

## Finding 1: `URL` is expensive in server hot paths

### The mechanism

In our SSR profiles, `URL` construction/parsing showed up as significant self-time in the hot path on link-heavy endpoints. The cost comes from doing real work (parsing/normalization) and allocating objects. When you do it once, it does not matter. When you do it per link, per request, it dominates.

### The transferable pattern

Use cheap predicates first, then fall back to heavyweight parsing only when needed.

- If a value is clearly internal (e.g. starts with `/` but not `//`, or starts with `.`), don't try to parse it as an absolute URL.
- If a feature is only needed in edge cases (e.g. rewrite logic), keep it off the default path.

### What we changed

```typescript
// Before: always parse
const url = new URL(to, base)

// After: check first, parse only if needed
if (isSafeInternal(to)) {
  // fast path: internal navigation, no parsing needed
} else {
  const url = new URL(to, base)
  // ...external URL handling
}
```

The `isSafeInternal` check can be orders of magnitude cheaper than constructing a `URL` object[^url-cost]. It's meant to be a cheap predicate, so it is okay if some URLs that _would_ be internal are classified as external and go through the slower path.

See: [#6442](https://github.com/TanStack/router/pull/6442), [#6447](https://github.com/TanStack/router/pull/6447), [#6516](https://github.com/TanStack/router/pull/6516)

### Measuring the improvements

Like every PR in this series, this change was validated by profiling the impacted method before and after. For example we can see in the example below that the `buildLocation` method went from being one of the major bottlenecks of a navigation to being a very small part of the overall cost:

<figure>
<img src="/blog-assets/tanstack-start-5x-ssr-throughput/build-location-before.png" alt="CPU profiling of buildLocation before the changes">
<figcaption>
<b>Before:</b> The <code>RouterCore.buildLocation</code> (red arrow) method was creating a <code>new URL</code> every time (purple blocks), and then updating its search which re-triggers an expensive parsing step.
</figcaption>
</figure>

<figure>
<img
src="/blog-assets/tanstack-start-5x-ssr-throughput/build-location-after.png"
alt="CPU profiling of buildLocation after the changes"
>
<figcaption>
<b>After:</b> The <code>isSafeInternal</code> check is able to fully skip the <code>URL</code>. <code>RouterCore.buildLocation</code> becomes an almost insignificant part of the overall cost.
</figcaption>
</figure>

## Finding 2: SSR does not need reactivity

### The mechanism

SSR renders once per request.[^ssr-streaming] There is no ongoing UI to reactively update, so on the server:

- store subscriptions add overhead but provide no benefit
- structural sharing[^structural-sharing] reduces re-renders, but SSR does not re-render
- batching reactive updates is irrelevant if nothing is subscribed

### The transferable pattern

If your code supports both client reactivity and SSR, gate the reactive machinery so the server can skip it entirely:

- on the server: return state directly, no subscriptions, reduce immutability overhead
- on the client: subscribe normally

This is the difference between "server = a function" and "client = a reactive system".

### What we changed

```typescript
// Before: same code path for client and server
function useRouterState() {
  return useStore(router, { ... }) // unnecessary subscription on the server
}

// After: server gets a simple snapshot
function useRouterState() {
  if (isServer) return router.store // no subscriptions on the server
  return useStore(router, { ... }) // regular behavior on the client
}
```

See: [#6497](https://github.com/TanStack/router/pull/6497), [#6482](https://github.com/TanStack/router/pull/6482)

> [!NOTE]
> `isServer` is a build-time constant. This means that the above code is not violating the rules of hooks in React. At runtime, the code will always execute the same branch.

### Measuring the improvements

Taking the example of the `useRouterState` hook, we can see that most of the client-only work was removed from the SSR pass, leading to a ~2x improvement in the total CPU time of this hook.

<figure>
<img
  src="/blog-assets/tanstack-start-5x-ssr-throughput/router-state-before.png"
  alt="CPU profiling of useRouterState before the changes"
>
<figcaption>
<b>Before:</b> The <code>useRouterState</code> hook was subscribing to the router store, which triggers many sync and memoization calls before calling the <code>select</code> callback.
</figcaption>
</figure>

<figure>
<img
  src="/blog-assets/tanstack-start-5x-ssr-throughput/router-state-after.png"
  alt="CPU profiling of useRouterState after the changes"
>
<figcaption>
<b>After:</b> The <code>isServer</code> check is able to skip directly to the <code>select</code> callback.
</figcaption>
</figure>

## Finding 3: server-only fast paths are worth it (when gated correctly)

### The mechanism

As a general rule, client code cares about bundle size, while server code cares about CPU time per request. Those constraints are different.

If you can guard a branch with a **build-time constant** like `isServer`, you can:

- add server-only fast paths for common cases
- keep the general algorithm for correctness and edge cases
- allow bundlers to delete the server-only branch from client builds

In TanStack Start, `isServer` is provided via build-time resolution of export conditions[^export-conditions] (client: `false`, server: `true`, dev/test: `undefined` with fallback). Modern bundlers like Vite, Rollup, and esbuild perform dead code elimination (DCE)[^dce], removing unreachable branches when the condition is a compile-time constant.

### The transferable pattern

Write two implementations:

- **fast path** for the common case
- **general path** for correctness

And gate them behind a build-time constant so you don't inflate the bundle size for clients.

### What we changed

```typescript
// isServer is resolved at build time:
// - Vite/bundler replaces it with `true` (server) or `false` (client)
// - Dead code elimination removes the unused branch

if (isServer) {
  // server-only fast path (removed from client bundle)
  if (isCommonCase(input)) {
    return fastServerPath(input)
  }
}
// general algorithm that handles all cases
return generalPath(input)
```

See: [#4648](https://github.com/TanStack/router/pull/4648), [#6505](https://github.com/TanStack/router/pull/6505), [#6506](https://github.com/TanStack/router/pull/6506)

### Measuring the improvements

Taking the example of the `matchRoutesInternal` method, we can see that its children's total CPU time was reduced by ~25%.

<figure>
<img
  src="/blog-assets/tanstack-start-5x-ssr-throughput/interpolate-before.png"
  alt="CPU profiling of interpolatePath before the changes"
>
<figcaption>
<b>Before:</b> The <code>interpolatePath</code> function spends >1s using the generic <code>parseSegment</code> function.
</figcaption>
</figure>

<figure>
<img
  src="/blog-assets/tanstack-start-5x-ssr-throughput/interpolate-after.png"
  alt="CPU profiling of interpolatePath after the changes"
>
<figcaption>
<b>After:</b> The <code>interpolatePath</code> function now uses the server-only fast path, skipping <code>parseSegment</code> entirely.
</figcaption>
</figure>

## Finding 4: `delete` can be expensive

### The mechanism

Modern engines optimize property access using object "shapes" (e.g. V8 HiddenClasses[^v8-fast-properties] / JSC Structures[^webkit-delete-ic]) and inline caches. `delete` changes an object's shape and can force a slower internal representation (e.g. dictionary/slow properties), which can disable or degrade those optimizations and deopt optimized code.

### The transferable pattern

Avoid `delete` in hot paths. Prefer patterns that don't mutate object shapes in-place:

- set a property to `undefined` (when semantics allow)
- create a new object without the key (object rest destructuring) when you need a "key removed" shape

### What we changed

```typescript
// Before: mutates shape
delete this.shouldViewTransition

// After: set to undefined
this.shouldViewTransition = undefined
```

See: [#6456](https://github.com/TanStack/router/pull/6456), [#6515](https://github.com/TanStack/router/pull/6515)

### Measuring the improvements

Taking the example of the `startViewTransition` method, we can see that the total CPU time of this method was reduced by >50%.

<figure>
<img
  src="/blog-assets/tanstack-start-5x-ssr-throughput/delete-before.png"
  alt="CPU profiling of startViewTransition before the changes"
>
<figcaption>
<b>Before:</b> The <code>startViewTransition</code> function (red arrow) has ~400ms of self-time in the hot path (i.e. not including the time spent in its children).
</figcaption>
</figure>

<figure>
<img
  src="/blog-assets/tanstack-start-5x-ssr-throughput/delete-after.png"
  alt="CPU profiling of startViewTransition after the changes"
>
<figcaption>
<b>After:</b> Removing the <code>delete</code> statement almost completely removes the self-time of this function.
</figcaption>
</figure>

## Results

### Summary

Matteo Collina independently benchmarked Start's SSR performance as part of his [article investigating SSR performance across React meta-frameworks](https://blog.platformatic.dev/react-ssr-framework-benchmark-tanstack-start-react-router-nextjs) and observed significant improvements after our optimizations. The following table summarizes the before/after results under sustained load:

| Metric          |    Before |      After | Improvement              |
| --------------- | --------: | ---------: | ------------------------ |
| Success rate    |    75.52% |       100% | does not fail under load |
| Throughput      | 477 req/s | 1041 req/s | +118% (2.2x)             |
| Average latency |   3,171ms |     13.7ms | 231x faster              |
| p90 latency     |  10,001ms |     23.0ms | 435x faster              |
| p95 latency     |  10,001ms |     28.1ms | 370x faster              |

The "before" numbers show a server under severe stress: 25% of requests failed (likely timeouts), and p90/p95 hit the 10s timeout ceiling. After the optimizations, the server handles the same load comfortably with sub-30ms tail latency and zero failures.

To be clear: TanStack Start was not broken before these changes. Under normal traffic, SSR worked fine. These numbers reflect behavior under _sustained heavy load_ (the kind you see during traffic spikes or load testing). The optimizations increase headroom. At this same load, the server no longer drops requests, and it only starts failing at substantially higher load than before.

### Event-loop utilization

The following graphs show event-loop utilization[^elu] against throughput for each feature-focused endpoint, before and after the optimizations. Lower utilization at the same req/s means more headroom; higher req/s at the same utilization means more capacity.

For reference, the machine on which these were measured reaches 100% event-loop utilization at 100k req/s on an empty node http server[^empty-node-http-server].

#### 100 links per page

![Event-loop utilization vs throughput for links-100, before and after](/blog-assets/tanstack-start-5x-ssr-throughput/elu-links.png)

#### Deeply nested layout routes

![Event-loop utilization vs throughput for nested routes, before and after](/blog-assets/tanstack-start-5x-ssr-throughput/elu-nested.png)

#### Minimal route (baseline)

![Event-loop utilization vs throughput for minimal route, before and after](/blog-assets/tanstack-start-5x-ssr-throughput/elu-empty.png)

## Conclusion

The biggest gains came from removing whole categories of work from the server hot path. Throughput improves when you eliminate repeated work, allocations, and unnecessary generality in the steady state.

There were many other improvements (client and server) not covered here. SSR performance work is ongoing.

## References

[^v8-fast-properties]: V8 team, [Fast properties in V8](https://v8.dev/blog/fast-properties). Great article, but 9 years old so things might have changed.

[^webkit-delete-ic]: WebKit, [A Tour of Inline Caching with Delete](https://webkit.org/blog/10298/inline-caching-delete/)

[^structural-sharing]: Structural sharing is a pattern from immutable data libraries (Immer, React Query, TanStack Store) where unchanged portions of data structures are reused by reference to enable cheap equality checks. See [Structural Sharing](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations#structural-sharing) in the TanStack Query documentation.

[^ssr-streaming]: With streaming SSR and Suspense, the server may render multiple chunks, but each chunk is still a single-pass render with no reactive updates. See [renderToPipeableStream](https://react.dev/reference/react-dom/server/renderToPipeableStream) in the React documentation.

[^url-cost]: The WHATWG URL Standard requires significant parsing work: scheme detection, authority parsing, path normalization, query string handling, and percent-encoding. See the [URL parsing algorithm](https://url.spec.whatwg.org/#url-parsing) for the full state machine.

[^export-conditions]: Conditional exports are a Node.js feature that allows packages to define different entry points based on environment or import method. See [Conditional exports](https://nodejs.org/api/packages.html#conditional-exports) in the Node.js documentation.

[^dce]: Dead code elimination is a standard compiler optimization. See esbuild's documentation on [tree shaking](https://esbuild.github.io/api/#tree-shaking), Rollup's [tree-shaking guide](https://rollupjs.org/introduction/#tree-shaking) and Rich Harris's article on [dead code elimination](https://medium.com/@Rich_Harris/tree-shaking-versus-dead-code-elimination-d3765df85c80).

[^elu]: Event-loop utilization is the percentage of time the event loop is busy utilizing the CPU. See this [nodesource blog post](https://nodesource.com/blog/event-loop-utilization-nodejs) for more details.

[^empty-node-http-server]: To get a reference for the values we were measuring, we ran a similar `autocannon` benchmark on the smallest possible node http server: `require('http').createServer((q,s)=>s.end()).listen(3000)`. This tells us the _theoretical_ maximum throughput of the machine and test setup.
