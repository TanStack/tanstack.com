---
published: 2026-03-01
authors:
  - Florian Pellet
title: From One Big Router Store to a Granular Signal Graph
# title: How TanStack Router Became Granularly Reactive
# title: TanStack Router's Granular Reactivity Rewrite
# title: Why TanStack Router No Longer Rerenders the World
# title: Routing Is a Graph. Now Our Reactivity Is Too.
# title: TanStack Router: From Monolithic State to Signal Graph
---

![veins of emerald as a signal graph embedded in the rock of a tropical island](/blog-assets/tanstack-router-signal-graph/header.png)

# Granular Signal Graph Blog Plan

## Working Subtitle

How we replaced one broad router-state subscription with per-match stores, injectable store implementations, and a model that matches how routing actually works more closely.

## Article Shape

- Length: about 2,000–2,500 words
- Audience: engineering-heavy readers
- Tone: mechanism before marketing, confident but concrete
- Every claim should be substantiated by code, by measurements/graphs, or by an external trustworthy source

## Core Thesis

TanStack Router changed shape: from one coarse reactive router state to a granular store graph with explicit lifetimes and injectable store implementations. The performance wins matter because they validate a better architecture, not because the article is about benchmarks.

---

## Tight Outline

### 1. Intro

**Section goal:** Set the stakes. This was not a "swap in signals" refactor; the router's internal reactive model changed shape.

**Transition out:** "To understand why that matters, you need to see what we were working with."

### 2. The Old Model

**Working title:** _One store to rule them all_

**Section goal:** Explain `router.state` as the old center of gravity. Location, active matches, pending matches, cached matches, route-level lookups — all bundled into one reactive object. That model was not just convenient, it was essential to quickly prototype and ship a lot of the APIs we like. But it also meant every consumer subscribed to essentially the same broad surface.

**Transition out:** "This worked well, but it also meant the reactive model was broader than the underlying routing behavior."

### 3. Why Routing Is Naturally Granular

**Working title:** _The mismatch_

**Section goal:** Make the architectural argument. A navigation changes specific things with specific relationships: one match becomes pending, another stays active, a link flips, a leaf loads data. The old model collapsed all of that into one event. The reactive surface should reflect the actual locality of routing.

<figure>
<video src="/blog-assets/tanstack-router-signal-graph/before-router-state-blob.mp4" playsinline loop autoplay muted></video>
<figcaption>
A video showing that on every stateful event in the core of the router, changes are propagated to every subscription across the entire application.
</figcaption>
</figure>

**Transition out:** "So we redesigned the internals to match."

### 4. The New Model

**Working title:** _A graph of stores_

**Section goal:** Introduce the new architecture. Top-level atoms for location and status. Separate active, pending, and cached match pools. Per-match stores. Per-route computed stores that derive "the current active match for route X" from the pool. `RouterState` still exists as a compatibility view but is no longer the real implementation.

**Visuals:**

- Show the before animated diagram in section 2
- Show the after animated diagram here
- Brief callout to the before/after videos

<figure>
<video src="/blog-assets/tanstack-router-signal-graph/after-granular-store-graph.mp4" playsinline loop autoplay muted></video>
<figcaption>
A video showing that on stateful event in the core of the router, only specific subset of subscribers are updated in the application.
</figcaption>
</figure>

**Transition out:** "The most interesting piece of this is what happens at the per-route level."

### 5. Per-Match and Per-Route Reactivity

**Working title:** _Subscribe to what you need_

**Section goal:** This is the deepest technical section and the clearest expression of the refactor. Explain the shift from "subscribe broadly, then scan `state.matches` for the route you care about" to "subscribe directly to the relevant match store or route-derived store". The hero example is `useMatch`.

**Points to cover:**

- Before: `useMatch` subscribed through the big router store, then searched `state.matches` to find the right match.
- After: `useMatch` resolves the relevant store first, then subscribes directly to it.
- For `opts.from`, `getMatchStoreByRouteId(routeId)` gives one cached computed store per route id.
- That computed store depends on `matchesId` plus the resolved match store, so unrelated match updates do not propagate through it.
- For nearest-match reads, the hook can subscribe directly to the active match store from context.
- The LRU cache is a practical detail worth mentioning because it shows this was engineered, not just conceptual.

**Evidence to place here:**

- Store-update-count history graphs for React, Solid, and Vue
- These graphs belong here because they are the most direct evidence that narrower subscriptions remove unnecessary work

<!-- ::start:tabs -->

#### React

![A graph showing the number of times a useRouterState subscription is triggered in various test scenarios, going from a 5 to 18 range down to a 0 to 8 range](/blog-assets/tanstack-router-signal-graph/store-updates-history-react.png)

#### Solid

![A graph showing the number of times a useRouterState subscription is triggered in various test scenarios, going from a 3 to 19 range down to a 0 to 8 range](/blog-assets/tanstack-router-signal-graph/store-updates-history-solid.png)

#### Vue

![A graph showing the number of times a useRouterState subscription is triggered in various test scenarios, going from a 6 to 46 range down to a 2 to 16 range](/blog-assets/tanstack-router-signal-graph/store-updates-history-vue.png)

<!-- ::end:tabs -->

**Transition out:** "Once the model is granular, the store boundary gets a lot cleaner too."

### 6. Injectable Store Implementations

**Working title:** _One contract, multiple implementations_

**Section goal:** Explain that the router core now defines a reactive contract instead of hardcoding one store engine. React and Vue plug in TanStack Store (now powered by alien-signals, thanks to @DavidKPiano). Solid plugs in native signals and memos. Same granular model, different store implementations.

This is the section that makes the architecture feel unusually well-designed.

**Transition out:** "All of this is invisible to users. The APIs didn't change."

### 7. What Users Actually Feel

**Working title:** _Less work, same API_

**Section goal:** Translate the architectural work into user-visible consequences. Existing hooks and components (`useMatch`, `useLocation`, `Link`, match rendering) now subscribe more narrowly by default. No new API to learn. The router just does less unnecessary work during navigation and preload flows.

**Points to cover:**

- This refactor does not ask users to adopt a new API or a new mental model.
- The same public hooks now react with more locality because the underlying subscriptions are narrower.
- This is why the wins show up during navigation-heavy paths: links, match updates, pending transitions, route changes.
- Keep this section focused on observable behavior, not internal implementation details.

**Evidence to place here:**

- Client-side navigation benchmark history graphs for React, Solid, and Vue
- Present the benchmark as intentionally stressing rerender-heavy client-side navigation, not as a universal app benchmark
- Small bundle-size markdown table if it reads naturally here; otherwise keep it near the closing as a short tradeoff note

<!-- ::start:tabs -->

#### React

![A graph showing the duration of 10 navigations on a synthetic tanstack/react-router app going from about 70ms to about 45ms](/blog-assets/tanstack-router-signal-graph/client-side-nav-react.png)

#### Solid

![A graph showing the duration of 10 navigations on a synthetic tanstack/solid-router app going from about 120ms to about 80ms](/blog-assets/tanstack-router-signal-graph/client-side-nav-solid.png)

#### Vue

![A graph showing the duration of 10 navigations on a synthetic tanstack/vue-router app going from about 75ms to about 60ms](/blog-assets/tanstack-router-signal-graph/client-side-nav-vue.png)

<!-- ::end:tabs -->

<!-- ::start:tabs -->

#### React

![A graph the history of the bundle size of a synthetic tanstack/react-router app, gaining 1KiB gzipped with this latest change](/blog-assets/tanstack-router-signal-graph/bundle-size-history-react.png)

#### Solid

![A graph the history of the bundle size of a synthetic tanstack/solid-router app, shedding 1KiB gzipped with this latest change](/blog-assets/tanstack-router-signal-graph/bundle-size-history-solid.png)

#### Vue

![A graph the history of the bundle size of a synthetic tanstack/vue-router app, gaining 1KiB gzipped with this latest change](/blog-assets/tanstack-router-signal-graph/bundle-size-history-vue.png)

<!-- ::end:tabs -->

**Transition out:** "The performance graphs are a consequence of the architecture, not the article's thesis."

### 8. Closing

**Section goal:** End on the conceptual takeaway, not just numbers. TanStack Router got faster because it models routing in a more granular way.

---

## Visuals Inventory

| Visual                                     | Status   | Placement      |
| ------------------------------------------ | -------- | -------------- |
| Before/after animated diagram (before)     | Done     | Section 2      |
| Before/after animated diagram (after)      | Done     | Section 4      |
| Store-update-count history graph — React   | Done     | Section 5      |
| Store-update-count history graph — Solid   | Done     | Section 5      |
| Store-update-count history graph — Vue     | Done     | Section 5      |
| Client-nav benchmark history graph — React | Done     | Section 7      |
| Client-nav benchmark history graph — Solid | Done     | Section 7      |
| Client-nav benchmark history graph — Vue   | Done     | Section 7      |
| Bundle-size delta table (markdown)         | To write | Section 7 or 8 |

## Code Snippets

TBD — will discover what we need during drafting. Candidates if needed:

- A before/after of what `useMatch` subscribes to internally
- The `getMatchStoreByRouteId` derived-store pattern
- The store-factory contract that adapters implement

## Writing Guardrails

- Keep `signals` as supporting vocabulary, not the headline story.
- Keep benchmarks as proof of the redesign, not the reason for it.
- Emphasize architectural locality over raw speed.
- Make the multi-framework angle feel like the natural payoff of a clean boundary.
- Mention alien-signals and credit @DavidKPiano, but keep it to 1–2 sentences.
- No SSR section (the optimization was not new for React; Solid/Vue just caught up).
- Every claim should be substantiated by code, by measurements/graphs, or by an external trustworthy source.

---

## Intro Draft

TanStack Store recently migrated to [alien-signals](https://github.com/stackblitz/alien-signals) under the hood, replacing its previous reactive engine with a hyper-performant push-pull signal graph. This was great work by [@DavidKPiano](https://github.com/davidkpiano), and it gave us a faster reactive primitive to build on.

But faster primitives alone do not make a router faster. The more important question is what the router is _doing_ with its reactive state.

For a long time, TanStack Router centered its reactivity around one large object: `router.state`. It held location, active matches, pending matches, cached matches, route-level data, status flags, and more. That model was useful, and it helped us prototype and ship many of the APIs the router has today. But it also meant many consumers were still subscribing through the same broad reactive surface, even when they only cared about one route match or one small part of navigation state.

This refactor changes that internal shape.

It does not add a signals API, and it does not expose new primitives. What it does is replace one coarse reactive store with a graph of smaller, purpose-specific stores, and make the store implementation itself injectable so React and Vue can use TanStack Store while Solid can use native signals.

The result is a router that does less unnecessary work: significantly fewer store updates during navigation, substantially faster synthetic client-side navigation benchmarks, and a more granular internal model for routing state.

---
