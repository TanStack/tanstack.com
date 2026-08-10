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

Overlap exposes three boundaries that a single happy-path navigation can hide:

- losing permission to publish is not the same as losing ownership of asynchronous work;
- one loader's outcome is not yet the outcome of the route attempt;
- publishing router state is not proof that the framework rendered it.

The detailed timeline puts all three into the opening scenario. Read it as a worked example, not as a required ordering: independent events, such as caching `/account` and publishing `/login`, can happen in either order.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_concurrent-orchestration.svg" style="width:100%" alt="A detailed sequence diagram where an account preload and navigation share a loader flight, settings supersedes account, nested settings loaders produce an error and redirect, account data reaches cache, login matches publish, and the framework acknowledges rendering them">
<figcaption>
Replacing the current transaction does not necessarily end a shared loader flight. Loader outcomes first return to a private lane, and published matches cross a separate framework-render boundary.
</figcaption>
</figure>

The final publish arrow compresses two steps: the private lane selects a result, then the current transaction confirms that it may publish. A loader flight cannot publish a destination by itself.

### Authority Is Not Ownership

The current transaction answers one narrow question: **which navigation may change the page?** Replacing it revokes that authority from the previous navigation. It says nothing by itself about whether every promise started by that navigation has become useless.

A loader flight has its own owners. A preload, a navigation, and a cached match can each hold a lease on the same invocation. An unsettled flight is aborted only when no owner still needs it. This is why superseding a navigation and aborting a loader are separate operations.

Sharing also stops at the flight boundary. Every consumer keeps a private lane with its own `cause`, route context, and guard results. Only a current transaction may publish one of those lanes. Reusing a promise must not mean reusing another navigation's draft route state.

In the diagram, `/settings` takes publish authority from `/account`, but the preload still owns the shared account flight. That flight may finish and populate the cache even though `/account` can no longer reach the page.

A loader flight can also outlive its promise. An accepted or cached match may keep its lease after the loader returns. Ownership ends only when the last consumer releases it.

### A Loader Outcome Is Not a Route Outcome

A rejected loader promise is a local fact. It is not automatically a decision to render an error page. Other loaders that already started may still produce control flow, such as a redirect, that changes the meaning of the whole attempt.

The router therefore normalizes individual settlements and returns them to the lane. The lane reducer considers the outcomes together and selects one semantic result. Only that reduced result can be projected into publishable matches.

The settings branch demonstrates the distinction. Its layout loader records an ordinary error, while its already-running index loader redirects. The redirect changes the destination to `/login`; the earlier error remains evidence from a discarded settings attempt, not UI to publish.

If the router had published the first rejected promise immediately, the user could briefly see the settings error before being sent to login. If it had canceled every descendant on the first error, it might never discover the redirect.

Loader settlement produces evidence. The lane decides what that evidence means for the route attempt.

### Published State Is Not Rendered UI

Publication is the boundary between router core and a framework adapter. The router can offer a new `matches` array, but React, Solid, or Vue controls when that offer becomes visible. A suspended React tree may never commit; a Solid transition may still be running; Vue may still be waiting for its render tick.

Exact publication receipts are new in the rewrite. Previously, the adapters had render-related effects and broad transition flags, but core received no acknowledgement tied to one specific publication. The adapter now returns a receipt for every offer.[^framework-ack]

The receipt can settle `false` when that publication is superseded before it renders. Settlement means the framework transition no longer blocks navigation completion. A `true` acknowledgement is stricter: it confirms that the requested `matches` appeared. The router uses that stronger signal for `onRendered` and pending UI timing.

Pending UI follows the same rule. If `pendingMs` expires, the router can publish a pending presentation, but `pendingMinMs` starts only after the framework confirms that the fallback rendered. A fallback superseded before it appears adds no artificial delay.[^pending]

In the diagram, publishing `/login` asks the framework to render it. The receipt reports what happened; it does not grant publish authority or decide which route won.

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
> The diagrams are a teaching slice, not a complete inventory. The implementation also assigns distinct owners to preflight planning, pending UI presentation, preload and cache entries, hydration handoff, development HMR rollback, and server request and stream cleanup.
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

[^framework-ack]: Before the rewrite, React's adapter used [global loading and transition flags](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/react-router/src/Transitioner.tsx#L86-L128), while `startTransition` itself [returned no receipt](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/react-router/src/Transitioner.tsx#L13-L32). It now acknowledges the exact offered match-array reference through a [transition owner](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/src/Transitioner.tsx#L9-L46) and a [`Matches` layout effect](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/src/Matches.tsx#L74-L92). Solid awaits [`Solid.startTransition`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/solid-router/src/Transitioner.tsx#L17-L27), while Vue awaits its [render tick](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/vue-router/src/Transitioner.tsx#L12-L17).

[^pending]: The [`PendingSession`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L217-L225) owns one reveal/minimum-visible deadline and its acknowledgement. [`offerPending`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1385-L1523) starts the minimum only after a positive render acknowledgement.

[^other-lifetimes]: The architecture guide's [authority table and code map](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L27-L71) cover client planning, presentation, cache, hydration, refresh, server requests, and accepted streams. Normal component chunks participate in [loader readiness](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L919-L950), [scroll restoration subscribes to `onRendered`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/scroll-restoration.ts#L216-L245), and final client publication runs inside the router's [view-transition boundary](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1956-L2013).
