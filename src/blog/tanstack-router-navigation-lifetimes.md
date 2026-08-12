---
published: 2026-08-05
draft: true
authors:
  - Florian Pellet
title: 'Inside a TanStack Router Navigation'
excerpt: 'A navigation looks like one asynchronous operation. Inside TanStack Router, separate owners coordinate matching, loaders, pending UI, redirects, caching, and rendering.'
library: router
---

![A meandering river flows, its tributaries joining and separating](/blog-assets/tanstack-router-loading-lifetimes/header.png)

From application code, a navigation looks almost too simple:

```ts
await router.navigate({ to: '/account' })
```

Now let's imagine a slightly more complex scenario.

<video src="/blog-assets/tanstack-router-loading-lifetimes/tanstack-router-navigation-demo.mp4" autoplay muted loop playsinline controls />

1. The user hovers a link, and the router starts preloading `/account`
2. They click the link while its loader is still running, so the navigation joins the work that the hover already started
3. While it's still loading, they click `/settings`, which has many parallel `loader` calls to run
4. The layout loader errors, but the index loader redirects to `/login`
5. Meanwhile, the `/account` loader settles. The user is no longer going to `/account` but its result can enter the cache
6. The router eventually publishes `/login` but its content suspends
7. Finally, the suspense resolves and the framework renders the `/login` page

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_simple-scenario.svg" style="width:100%" alt="A timeline where an account preload is joined by a navigation, a later settings navigation starts layout and index loaders, the index loader redirects to login, account data also enters the cache, and the framework acknowledges login after publication">
<figcaption>
Even this simplified timeline has work being shared, superseded, redirected, cached, published, and rendered on different schedules.
</figcaption>
</figure>

Which result is allowed to reach the page? Which loader should be canceled? Does the first error win? Is the navigation finished when router state changes, or when the framework renders it?

Those questions do not have one shared answer.

We learned this the hard way. [A rewrite of TanStack Router's route loading core](https://github.com/TanStack/router/pull/7805) grew around dozens of linked reports and patches across preloading, redirects, caching, pending UI, SSR, and more. They looked unrelated, but most crossed the same boundary: one part of the router was answering a question that belonged to another.

The new model assigns separate owners to publishing, route outcomes, loader work, and rendering. There is still one `navigate()` call at the API boundary, but there is no single owner of everything inside it.[^architecture]

## Even One Navigation Is an Orchestration

Before adding concurrency between navigations, it helps to slow down one ordinary navigation.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_single-orchestration.svg" style="width:100%" alt="A single navigation moving through route matching, transaction acquisition, context building, parallel loader flights, pending UI publication, outcome selection, final match publication, and framework render acknowledgements">
<figcaption>
Even one navigation moves along several schedules: loaders run, pending UI may appear, final matches publish, and the framework renders each publication in its own time.
</figcaption>
</figure>

A **lane** is a private, unpublished draft of the matched route branch. Reading from left to right:

1. **Route matching** turns the destination URL into an ordered branch of route matches.
2. The navigation becomes the **current transaction**, giving it permission to publish if it is still current when the work finishes.[^planning]
3. It builds route context and runs `beforeLoad` from parent to child. Children need the completed context of their parents, so this part is intentionally serial.
4. Once that chain is ready, eligible route loaders can run in parallel. Each actual loader invocation is a **loader flight**.
5. If loading crosses the route's `pendingMs` threshold, the router can publish a pending component. That publication gets its own framework receipt.
6. The lane waits for the loader outcomes it needs, then decides whether the route succeeded, failed, or redirected.
7. If the navigation is still current, it publishes the final matches. The framework receipt settles, and only then may the navigation complete.

These steps are not one long waterfall. The pending timer races the loaders. Normal route components can load alongside them. A framework render can be in progress while the private lane continues toward its final result.

> [!NOTE]
> `Promise.allSettled` is shorthand here. The router waits for the outcomes needed to choose between success, failure, and redirect.[^reduction]

The common client-side path is easier to reason about as four separate tracks. A **flight** is one real loader invocation that compatible consumers can share. A **lease** is a claim that one consumer still needs that flight.[^flights]

| Owner                        | Decides                                                     | Ends when                                                         |
| ---------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| **Current transaction**      | May this navigation publish?                                | A successor replaces its authority                                |
| **Private lane**             | Did this route attempt succeed, fail, or redirect?          | The lane is accepted, redirected, or discarded                    |
| **Loader flight**            | Should this loader invocation remain alive?                 | Its final navigation, preload, or cached owner releases its lease |
| **Framework render receipt** | May the transition finish, and did this publication render? | The receipt settles or is superseded                              |

> [!NOTE]
> The lane's phases are encoded in TypeScript as `matched`, `contextualized`, `reduced`, and `projected`. The brands add no runtime state; they stop code that expects a finished phase from accepting an earlier one.[^lane-phases]

Most of the time these tracks advance within a few milliseconds of each other. That creates the useful illusion that navigation is one asynchronous task.

Overlap is where the illusion breaks.

## When Navigations Overlap

Overlap exposes four ideas that a single happy-path navigation can hide:

- shared loader work stays alive through leases held by independent consumers;
- losing permission to publish is not the same as losing ownership of that work;
- one loader's outcome is not yet the outcome of the route attempt;
- publishing router state is not proof that the framework rendered it.

The detailed timeline puts all four into the opening scenario. Read it as a worked example, not as a required ordering: independent events, such as caching `/account` and publishing `/login`, can happen in either order.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_concurrent-orchestration.svg" style="width:100%" alt="A detailed sequence diagram where an account preload and navigation share a loader flight, settings supersedes account, nested settings loaders produce an error and redirect, account data reaches cache, login matches publish, and the framework acknowledges rendering them">
<figcaption>
Replacing the current transaction does not necessarily end a shared loader flight. Loader outcomes first return to a private lane, and published matches cross a separate framework-render boundary.
</figcaption>
</figure>

The final publish arrow compresses two steps: the private lane selects a result, then the current transaction confirms that it may publish. A loader flight cannot publish a destination by itself.

### One Loader, Several Leases

<!-- explain "lease" -->

In the detailed timeline, the `/account` preload and navigation do not merely happen to await the same promise. They each hold a **lease** on one loader flight.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_mini-lease-explainer.svg" style="width:100%; max-width:400px; margin: auto;" alt="One loader flight shared across three overlapping lease lifetimes, with its lease count rising from one to three and falling back to zero">
<figcaption>
Consumers acquire and release their own claims on one loader invocation. The flight remains owned until the final lease ends.
</figcaption>
</figure>

Holding a lease means "this consumer still needs the shared work." Acquiring one increments the flight's lease count, releasing one removes only that consumer's claim. If the count reaches zero while the invocation is still pending, its controller can be aborted.[^flights]

Several kinds of _consumers_ can hold a lease on a loader flight: a cached route, a rendered route, a pending route, and a preloading route. These leases can last long after the loader promise has settled: the claim is about resource lifetime.

In the opening scenario, the preload acquires the first lease. The `/account` navigation joins the flight and acquires another. When `/settings` supersedes that navigation, only the navigation's lease is released, but the preload still holds it, so the promise isn't aborted and the loader's result gets cached when it finally settles.

### The Navigation Was Replaced. Its Loader Kept Going.

<!-- explain "transaction" -->

The current transaction answers one narrow question: **which navigation may change the page?** Once `/settings` becomes current, it takes that authority from `/account`. It does not make every task associated with `/account` useless.

| Once `/settings` is current  | State                    | Consequence                                     |
| ---------------------------- | ------------------------ | ----------------------------------------------- |
| **Current transaction**      | `/settings`              | Only the settings lane may publish              |
| **Private `/account` lane**  | Superseded               | It cannot publish; its navigation lease ends    |
| **`/account` loader flight** | Preload lease still held | It may continue, settle, and populate the cache |

Only the loader invocation and its normalized outcome were shared. The preload and navigation still had separate lanes, with their own matching, context, `beforeLoad`, and control flow. Reusing the flight must not mean reusing another consumer's draft route state.

This separation lets the router discard an obsolete page decision without destroying work that another owner can still use.

### The Error Finished First. The Redirect Still Won.

<!-- explain "reduction" -->

Both settings loaders have already started when the layout loader fails. That error is a local fact, not yet a decision to render an error page.

```text
layout loader  → error                ordinary failure, provisional
index loader   → redirect('/login')   control flow
                                      ────────────────────────────
lane result    → redirect('/login')
```

The router normalizes individual settlements and returns them to the private lane. The first ordinary failure is provisional because an already-started descendant may still redirect. When that redirect arrives, it replaces the provisional failure as the route-level result.[^reduction]

This is control-flow precedence, not a general ranking where redirects are "more important" than errors. If no redirect appears, reduction still has to select an ordinary failure and a renderable boundary. The important rule is that promise timing alone does not decide what reaches the page.

The settings error therefore remains evidence from a discarded attempt. The transaction follows the redirect with a new `/login` lane, and no settings error UI is published.

### `/login` Was Published Before React Rendered It

<!-- explain "ack" -->

At the bottom of the detailed timeline, `Publish /login` and `Ack render` are deliberately separate events. Publication means the router has accepted the lane, written its `matches` to the store, and asked React to render them. It does not mean the `/login` tree committed.

React may already be working on an older tree that is suspended. The new rendering attempt can also discover another promise: a component might call `useSuspenseQuery`, call `use(promise)`, or come from `lazy(() => import(...))`. React can keep the previously committed UI visible while it waits. If another navigation arrives first, the `/login` attempt may never commit at all.

That distinction splits the navigation lifecycle around the framework boundary:[^publication-events]

| Moment                                      | Lifecycle work                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **The router publishes the matches**        | Route `onLeave`/`onEnter`/`onStay` callbacks run, followed by `onLoad` and `onBeforeRouteMount`                                             |
| **The framework receipt settles**           | If the transaction is still current, the router marks it resolved, emits `onResolved`, and may complete the navigation                      |
| **The receipt specifically settles `true`** | The exact offered matches committed, so the router also emits `onRendered`; for a pending publication, its `pendingMinMs` minimum can begin |

To tell those cases apart, the React adapter installs a receipt for the exact offered `matches` array before publishing it. A `Matches` layout effect settles that receipt `true` only if the same array reaches a commit. If a newer publication replaces it first, the old receipt settles `false`.[^framework-ack]

Both values release the router's wait, but only `true` is evidence that this publication rendered. That boolean guard prevents an abandoned or older suspended tree from producing `onRendered` for the wrong publication. Here, "rendered" means React committed the tree and reached the layout effect, not that the browser finished painting it.

Pending UI uses the same rule. A pending fallback that never commits adds no artificial `pendingMinMs` delay.[^pending]

## One Bug Pattern, Many Symptoms

The reports linked from the rewrite were not copies of one bug. They appeared in different APIs and framework adapters. The ownership model connects many of them because their symptoms cross one of the boundaries we just followed.

| Ownership boundary                           | What breaks when it is blurred                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Publish authority / flight ownership**     | Treating transaction replacement or cache eviction as the end of a flight can repeatedly abort reusable parent work or strand an in-flight preload's bookkeeping ([#3928](https://github.com/TanStack/router/issues/3928), [#7759](https://github.com/TanStack/router/issues/7759))                                        |
| **Shared flight / private lane**             | Sharing more than the loader result lets one lane observe another's `cause` or `preload` flags, or leaves a child without fresh parent context ([#3179](https://github.com/TanStack/router/issues/3179), [#4572](https://github.com/TanStack/router/issues/4572), [#7602](https://github.com/TanStack/router/issues/7602)) |
| **Redirect control flow / presentation**     | A pending or stale match marked as redirected can reach `MatchInner`, even though a redirect should produce another lane rather than UI ([#7120](https://github.com/TanStack/router/issues/7120), [#7367](https://github.com/TanStack/router/issues/7367), [#7753](https://github.com/TanStack/router/issues/7753))        |
| **Router publication / framework rendering** | Without a publication-scoped receipt, core can observe only broad transition state, not whether the exact offered matches rendered ([render-owner contract](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/tests/react-render-owner-contract.test.tsx#L21-L101))   |

This table is a map of ownership boundaries, not a changelog. Waiting for an already-running child redirect after a parent loader error already worked. The surrounding work added regression coverage, and the new pipeline preserves that precedence in an explicit reducer.[^reduction] Exact publication receipts are the opposite case: they are a new contract, not a repair to a previous exact receipt.

The fix was not to serialize navigation. It was to give concurrent work explicit boundaries, so that each fact is interpreted by the owner with enough context to act on it.

> [!NOTE]
> The diagrams are a teaching slice, not a complete inventory. Examples in the implementation include preflight planning, pending UI presentation, preload and cache entries, hydration handoff, development HMR rollback, and server request and stream cleanup. Background reloads are another: they keep successful loader data visible while a private candidate runs, then require both their transaction and exact committed base to remain current before publishing.
>
> Other features attach to those boundaries instead of creating one larger navigation owner: lazy component readiness feeds into lane reduction, scroll restoration consumes rendered events, and view transitions wrap publication. Those details are not needed to follow the client navigation above.[^other-lifetimes]

## One Valid Page

Return to the opening timeline. `/account` can become irrelevant to the screen without becoming useless. A settings loader can fail without deciding the route. `/login` can be published before it has rendered.

Those are not contradictions. They are facts owned at different boundaries. The transaction gates publication, the lane turns many outcomes into one route decision, leases keep shared work alive, and the framework receipt tells core what crossed the gap between state and UI.

That is how `navigate()` can keep its simple shape. The router does not make concurrency disappear; it gives each consequence of concurrency somewhere precise to land, then lets one coherent result cross onto the screen.

---

[^architecture]: The rewrite's [internal architecture guide](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L53-L86) lists the independent publishing, resource, presentation, preload, hydration, and server authorities. The four tracks in this article cover the common client-side story; they are not the complete inventory.

[^planning]: The diagram compresses planning and execution into one navigation-authority track. In the implementation, a short-lived [`_preflight` owner](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L2017-L2111) protects events and route matching before the foreground transaction is installed.

[^lane-phases]: The [phase-branded lane types](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L135-L159) are phantom TypeScript evidence for the pipeline position.

[^reduction]: Before the rewrite, the loader path already [waited for started tasks and preferred redirect control flow](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/router-core/src/load-matches.ts#L1029-L1050). [Regression coverage for that existing behavior](https://github.com/TanStack/router/commit/3a5575627d46e765f7fab2e5488657d2b739273c) includes a [shared-flight variant](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/router-core/tests/loader-architecture-regressions.test.ts#L136-L208). In the new pipeline, [`settleTasks`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1034-L1080) records outcomes and [`reduceLane`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1082-L1215) selects one semantic lane or redirect.

[^flights]: A [`LoaderFlight`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L176-L184) contains one normalized outcome promise, its own abort controller, and a lease count. The [registry and release rules](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L472-L575) keep discoverability separate from ownership.

[^publication-events]: The final client [publication callback](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1956-L1975) commits the matches and emits `onLoad` and `onBeforeRouteMount` before awaiting the framework receipt; [`commitMatches`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1538-L1604) runs the route lifecycle callbacks. [After that receipt settles](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1983-L2013), core emits `onResolved`, and emits `onRendered` only for a current positive acknowledgement.

[^framework-ack]: Before the rewrite, React's adapter used [global loading and transition flags](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/react-router/src/Transitioner.tsx#L86-L128), while `startTransition` itself [returned no receipt](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/react-router/src/Transitioner.tsx#L13-L32). It now acknowledges the exact offered match-array reference through a [transition owner](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/src/Transitioner.tsx#L9-L46) and a [`Matches` layout effect](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/src/Matches.tsx#L74-L92). Solid awaits [`Solid.startTransition`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/solid-router/src/Transitioner.tsx#L17-L27), while Vue awaits its [render tick](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/vue-router/src/Transitioner.tsx#L12-L17).

[^pending]: The [`PendingSession`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L217-L225) owns one reveal/minimum-visible deadline and its acknowledgement. [`offerPending`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1385-L1523) starts the minimum only after a positive render acknowledgement.

[^other-lifetimes]: The architecture guide's [authority table and code map](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L27-L71) cover client planning, presentation, cache, hydration, refresh, server requests, and accepted streams. Its [background-reload model](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L817-L878) keeps a candidate private and guards publication by transaction and committed-base identity. Normal component chunks participate in [loader readiness](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L919-L950), [scroll restoration subscribes to `onRendered`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/scroll-restoration.ts#L216-L245), and final client publication runs inside the router's [view-transition boundary](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1956-L2013).
