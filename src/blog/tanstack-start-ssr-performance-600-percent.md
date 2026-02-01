---
id: ssr-performance-600-percent
title: 'From 3000ms to 14ms: profiling hot paths and eliminating bottlenecks in TanStack Start'
---

## Executive summary

We improved TanStack Router's SSR performance dramatically. Under sustained load:

- **Throughput**: 477 req/s → 1,041 req/s (**2.2x**)
- **Average latency**: 3,171ms → 14ms (**231x faster**)
- **p95 latency**: 10,001ms (timeout) → 29ms (**343x faster**)
- **Success rate**: 75% → 100% (the server stopped failing under load)

For SSR-heavy deployments, this translates directly to lower hosting costs, the ability to handle traffic spikes without scaling, and eliminating user-facing errors.

We did it with a repeatable process, not a single clever trick:

- **Measure under load**, not in microbenchmarks.
- Use CPU profiling to find the highest-impact work.
- Remove entire categories of cost from the server hot path:
  - avoid `URL` construction/parsing when it is not required
  - avoid reactivity work during SSR (subscriptions, structural sharing, batching)
  - add server-only fast paths behind a build-time `isServer` flag
  - avoid `delete` in performance-sensitive code

The changes span ~20 PRs; we highlight the highest-impact patterns below. This article focuses on methodology and mechanisms you can reuse in any SSR framework.

## What we optimized (and what we did not)

This work started after `v1.154.4` and targets server-side rendering performance. The goal was to increase throughput and reduce server CPU time per request while keeping correctness guarantees.

We are not claiming that any single line of code is "the" reason. This work spanned over 20 PRs, with still more to come. And every change was validated by:

- a stable load test
- a CPU profile (flamegraph)
- a before/after comparison on the same benchmark endpoint

## Methodology: feature-focused endpoints + flamegraphs

### Why feature-focused endpoints

We did not benchmark "a representative app page". We used endpoints that exaggerate a feature so the profile is unambiguous:

- **`links-100`**: renders ~100 links to stress link rendering and location building.
- **`layouts-26-with-params`**: deep nesting + params to stress matching and path/param work.
- **`empty`**: minimal route to establish a baseline for framework overhead.

This is transferable: isolate the subsystem you want to improve, and benchmark that.

### Load generation with `autocannon`

We used `autocannon` to generate a 30s sustained load. We tracked:

- req/s
- latency distribution (avg, p95, p99)

Example command (adjust concurrency and route):

```bash
autocannon -d 30 -c 100 --warmup [ -d 2 -c 20 ] http://localhost:3000/bench/links-100
```

### CPU profiling with `@platformatic/flame`

While the server handled load, we recorded CPU profiles using `@platformatic/flame`.

How we read the flamegraph:

- Focus on **self time** first. That is where the CPU is actually spent, not just where time is waiting on children.
- Fix one hotspot, re-run, and re-profile.
- Prefer changes that remove work in the steady state, not just shift it.

Placeholders you should replace with real screenshots:

- `<!-- FLAMEGRAPH: links-100 before -->`
- `<!-- FLAMEGRAPH: links-100 after -->`
- `<!-- FLAMEGRAPH: layouts-26-with-params before -->`
- `<!-- FLAMEGRAPH: layouts-26-with-params after -->`

### Reproducing these benchmarks

**Environment:**

Our benchmarks were stable enough to produce very similar results on a range of setups. However here are the exact environment details we used to run the benchmarks:

- Node.js: v24.12.0
- Hardware: Macbook Pro M3
- OS: macOS 15.7

**Running the benchmark:**

For fast iteration, we setup a single `pnpm bench` command what would concurrently

- start the built server through `@platformatic/flame` to profile it
  ```sh
  flame run ./dist/server.mjs
  ```
- run `autocannon` to stress the server by firing many requests at it
  ```sh
  autocannon -d 30 -c 100 --warmup [ -d 2 -c 20 ] http://localhost:3000/bench/links-100
  ```

## Finding 1: `URL` is expensive in server hot paths

### The mechanism

In our SSR profiles, `URL` construction/parsing showed up as significant self-time in the hot path on link-heavy endpoints. The cost comes from doing real work (parsing/normalization) and allocating objects. When you do it once, it does not matter. When you do it per link, per request, it dominates.

### The transferable pattern

Use cheap predicates first, then fall back to heavyweight parsing only when needed.

- If a value is clearly internal (eg starts with `/`, `.`, `..`), don't try to parse it as an absolute URL.
- If a feature is only needed in edge cases (eg rewrite logic), keep it off the default path.

### What we changed

```typescript
// Before: always parse
const url = new URL(to, base)

// After: check first, parse only if needed
if (isAbsoluteUrl(to)) {
  const url = new URL(to, base)
  // ...external URL handling
} else {
  // fast path: internal navigation, no parsing needed
}
```

See: [#6442](https://github.com/TanStack/router/pull/6442), [#6447](https://github.com/TanStack/router/pull/6447), [#6516](https://github.com/TanStack/router/pull/6516)

### How we proved it internally

This claim should be backed by your flamegraphs and measurements, not by opinion.

- `<!-- EVIDENCE: flamegraph shows URL construction/parsing as top self-time hotspot before -->`
- `<!-- EVIDENCE: same hotspot reduced/removed after -->`

## Finding 2: SSR does not need reactivity

### The mechanism

SSR renders once per request.[^ssr-streaming] There is no ongoing UI to reactively update, so on the server:

- store subscriptions add overhead but provide no benefit
- structural sharing[^structural-sharing] (replace-equal) reduces re-renders, but SSR does not re-render
- batching reactive notifications is irrelevant if nothing is subscribed

### The transferable pattern

If you have a runtime that supports both client reactivity and SSR, separate them:

- on the server: compute a snapshot and return it
- on the client: subscribe and use structural sharing to reduce render churn

This is the difference between "server = a function" and "client = a reactive system".

### What we changed

```typescript
// Before: same code path for client and server
store.subscribe(() => {
  /* ... */
}) // overhead on server
const next = replaceEqualDeep(prev, value) // unnecessary structural sharing

// After: server gets a simple snapshot
if (isServer) {
  return computeSnapshot() // no subscriptions, no structural sharing
}
```

See: [#6497](https://github.com/TanStack/router/pull/6497), [#6502](https://github.com/TanStack/router/pull/6502)

## Finding 3: server-only fast paths are worth it (when gated correctly)

### The mechanism

Client code cares about bundle size. Server code cares about CPU time per request. Those constraints are different.

If you can guard a branch with a **build-time constant** like `isServer`, you can:

- add server-only fast paths for common cases
- keep the general algorithm for correctness and edge cases
- allow bundlers to delete the server-only branch from client builds

In TanStack Router, `isServer` is provided via build-time resolution (client: `false`, server: `true`, dev/test: `undefined` with fallback), so dead code elimination can remove entire blocks.

### The transferable pattern

Write two implementations:

- **fast path** for the common case
- **general path** for correctness

And gate them behind a build-time constant so you don't ship server-only logic to clients.

### What we changed

```typescript
// isServer is resolved at build time:
// - Vite/bundler replaces it with `true` (server) or `false` (client)
// - Dead code elimination removes the unused branch

if (isServer) {
  // server-only fast path (removed from client bundle)
  return fastServerPath(input)
}
// general algorithm (used on client, fallback on server in dev)
return generalPath(input)
```

See: [#4648](https://github.com/TanStack/router/pull/4648), [#6505](https://github.com/TanStack/router/pull/6505), [#6506](https://github.com/TanStack/router/pull/6506)

## Finding 4: `delete` can be expensive

### The mechanism

Modern engines optimize property access using object "shapes" (e.g. V8 HiddenClasses / JSC Structures) and inline caches. `delete` changes an object's shape and can force a slower internal representation (e.g. dictionary/slow properties), which can disable or degrade those optimizations and deopt optimized code.[^v8-fast-properties][^webkit-delete-ic]

### The transferable pattern

Avoid `delete` in hot paths. Prefer patterns that don't mutate object shapes in-place:

- set a property to `undefined` (when semantics allow)
- create a new object without the key (object rest destructuring) when you need a "key removed" shape

### What we changed

```typescript
// Before: mutates shape
delete linkProps.activeProps
delete linkProps.inactiveProps

// After: create new object without keys
const { activeProps, inactiveProps, ...rest } = linkProps
return rest
```

See: [#6456](https://github.com/TanStack/router/pull/6456), [#6515](https://github.com/TanStack/router/pull/6515)

## Results

Benchmark: placeholder text, should link to Matteo's article.

### Summary

| Metric       |    Before |      After | Improvement  |
| ------------ | --------: | ---------: | ------------ |
| Success Rate |    75.52% |       100% | +32%         |
| Throughput   | 477 req/s | 1041 req/s | +118% (2.2x) |
| Avg Response |   3,171ms |     13.7ms | 231x faster  |
| p(90)        |  10,001ms |     23.0ms | 435x faster  |
| p(95)        |  10,001ms |     29.1ms | 343x faster  |

The "before" numbers show a server under severe stress: 25% of requests failed (likely timeouts), and p90/p95 hit the 10s timeout ceiling. After the optimizations, the server handles the same load comfortably with sub-30ms tail latency and zero failures.

### Flamegraph evidence slots

- `<!-- FLAMEGRAPH: links-100 before -->`
- `<!-- FLAMEGRAPH: links-100 after -->`
- `<!-- FLAMEGRAPH: layouts-26-with-params before -->`
- `<!-- FLAMEGRAPH: layouts-26-with-params after -->`

## Conclusion

The biggest gains came from removing whole categories of work from the server hot path. The general lesson is simple: throughput improves when you eliminate repeated work, allocations, and unnecessary generality in the steady state.

There were many other improvements (client and server) not covered here. SSR performance work is ongoing.

## Fill-in checklist before publishing

- [x] Replace throughput placeholders with final numbers.
- [x] Replace latency placeholders (avg/p90/p95) with final numbers.
- [ ] Insert flamegraph screenshots and annotate the "before" hotspots and "after" removal.
- [ ] Ensure every external claim has a citation and every internal claim has evidence.
- [ ] Add `layouts-26-with-params` benchmark results (if desired).

## References

[^v8-fast-properties]: V8 team, "Fast properties in V8" `https://v8.dev/blog/fast-properties`

[^webkit-delete-ic]: WebKit, "A Tour of Inline Caching with Delete" `https://webkit.org/blog/10298/inline-caching-delete/`

[^structural-sharing]: Structural sharing is a pattern from immutable data libraries (Immer, React Query, TanStack Store) where unchanged portions of data structures are reused by reference to minimize allocation and enable cheap equality checks.

[^ssr-streaming]: With streaming SSR and Suspense, the server may render multiple chunks, but each chunk is still a single-pass render with no reactive updates.
