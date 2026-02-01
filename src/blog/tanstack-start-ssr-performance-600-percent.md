---
title: "600% faster SSR: profiling and eliminating server hot paths in TanStack Router"
published: 2026-02-04
authors:
  - Manuel Schiller
  - Florian Pellet
---

## Executive summary

We improved TanStack Router’s SSR request throughput by about **600%** (placeholder: **~16k → ~96k requests in 30s**). We did it with a repeatable process, not a single clever trick:

- **Measure under load**, not in microbenchmarks.
- Use CPU profiling to find the highest-impact work.
- Remove entire categories of cost from the server hot path:
  - avoid `URL` construction/parsing when it is not required
  - avoid reactivity work during SSR (subscriptions, structural sharing, batching)
  - add server-only fast paths behind a build-time `isServer` flag
  - avoid `delete` in performance-sensitive code

This article focuses on methodology and mechanisms you can reuse in any SSR framework.

## What we optimized (and what we did not)

This work started after `v1.154.4` and targets server-side rendering performance. The goal was to increase throughput and reduce server CPU time per request while keeping correctness guarantees.

We are not claiming that any single line of code is “the” reason. Every change was validated by:

- a stable load test
- a CPU profile (flamegraph)
- a before/after comparison on the same benchmark endpoint

## Methodology: feature-focused endpoints + flamegraphs

### Why feature-focused endpoints

We did not benchmark “a representative app page”. We used endpoints that exaggerate a feature so the profile is unambiguous:

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

## Finding 1: `URL` is expensive in server hot paths

### The mechanism

In our SSR profiles, `URL` construction/parsing showed up as significant self-time in the hot path on link-heavy endpoints. The cost comes from doing real work (parsing/normalization) and allocating objects. When you do it once, it does not matter. When you do it per link, per request, it dominates.

### The transferable pattern

Use cheap predicates first, then fall back to heavyweight parsing only when needed.

- If a value is clearly internal (eg starts with `/`, `.`, `..`), don’t try to parse it as an absolute URL.
- If a feature is only needed in edge cases (eg rewrite logic), keep it off the default path.

### How we proved it internally

This claim should be backed by your flamegraphs and measurements, not by opinion.

- `<!-- EVIDENCE: flamegraph shows URL construction/parsing as top self-time hotspot before -->`
- `<!-- EVIDENCE: same hotspot reduced/removed after -->`

## Finding 2: SSR does not need reactivity

### The mechanism

SSR renders once per request. There is no ongoing UI to reactively update, so on the server:

- store subscriptions add overhead but provide no benefit
- structural sharing (replace-equal) reduces re-renders, but SSR does not re-render
- batching reactive notifications is irrelevant if nothing is subscribed

### The transferable pattern

If you have a runtime that supports both client reactivity and SSR, separate them:

- on the server: compute a snapshot and return it
- on the client: subscribe and use structural sharing to reduce render churn

This is the difference between “server = a function” and “client = a reactive system”.

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

And gate them behind a build-time constant so you don’t ship server-only logic to clients.

## Finding 4: `delete` can be expensive

### The mechanism

Modern engines optimize property access using object “shapes” (e.g. V8 HiddenClasses / JSC Structures) and inline caches. `delete` changes an object’s shape and can force a slower internal representation (e.g. dictionary/slow properties), which can disable or degrade those optimizations and deopt optimized code.[^v8-fast-properties][^webkit-delete-ic]

### The transferable pattern

Avoid `delete` in hot paths. Prefer patterns that don’t mutate object shapes in-place:

- set a property to `undefined` (when semantics allow)
- create a new object without the key (object rest destructuring) when you need a “key removed” shape

## Results (placeholders)

Replace the placeholders below with your final measurements and keep the raw `autocannon` output in your internal notes.

### Throughput (30s runs)

| Endpoint               | Before req/30s | After req/30s |  Change |
| ---------------------- | -------------: | ------------: | ------: |
| links-100              |        **TBD** |       **TBD** | **TBD** |
| layouts-26-with-params |        **TBD** |       **TBD** | **TBD** |

### Latency distribution

| Endpoint               | Variant |     Avg |     p95 |     p99 |
| ---------------------- | ------- | ------: | ------: | ------: |
| links-100              | before  | **TBD** | **TBD** | **TBD** |
| links-100              | after   | **TBD** | **TBD** | **TBD** |
| layouts-26-with-params | before  | **TBD** | **TBD** | **TBD** |
| layouts-26-with-params | after   | **TBD** | **TBD** | **TBD** |

### Flamegraph evidence slots

- `<!-- FLAMEGRAPH: links-100 before -->`
- `<!-- FLAMEGRAPH: links-100 after -->`
- `<!-- FLAMEGRAPH: layouts-26-with-params before -->`
- `<!-- FLAMEGRAPH: layouts-26-with-params after -->`

## Conclusion

The biggest gains came from removing whole categories of work from the server hot path. The general lesson is simple: throughput improves when you eliminate repeated work, allocations, and unnecessary generality in the steady state.

There were many other improvements (client and server) not covered here. SSR performance work is ongoing.

## Fill-in checklist before publishing

- [ ] Replace throughput placeholders (req/30s) with final numbers.
- [ ] Replace latency placeholders (avg/p95/p99) with final numbers.
- [ ] Insert flamegraph screenshots and annotate the “before” hotspots and “after” removal.
- [ ] Ensure every external claim has a citation and every internal claim has evidence.

## References

[^v8-fast-properties]: V8 team, “Fast properties in V8” `https://v8.dev/blog/fast-properties`
[^webkit-delete-ic]: WebKit, “A Tour of Inline Caching with Delete” `https://webkit.org/blog/10298/inline-caching-delete/`
