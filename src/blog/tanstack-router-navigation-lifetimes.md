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
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_simple-scenario.svg" style="width:100%; max-width: 800px; margin: auto;" alt="A timeline where an account preload is joined by a navigation, a later settings navigation starts layout and index loaders, the index loader redirects to login, account data also enters the cache, and the framework acknowledges login after publication">
<figcaption>
Even this simplified timeline has work being shared, superseded, redirected, cached, published, and rendered on different schedules.
</figcaption>
</figure>

Which result is allowed to reach the page? Which loader should be canceled? Does the first error win? When is the navigation finished?

Those questions do not have one shared answer.

We learned this while [rewriting TanStack Router's loading system](https://github.com/TanStack/router/pull/7805). Dozens of bugs across preloading, redirects, caching, pending UI, SSR, and more looked unrelated. Many came from treating clues as facts: an aborted signal was taken to mean a navigation had been superseded, and a state update was taken to mean its matches had rendered.

Application code still sees one `navigate()` call, but inside the router, we use distinct owners for each fact: should a loader keep running, what did the route attempt decide, may this navigation publish, and did the framework actually render it?[^architecture]

## Even One Navigation Is an Orchestration

Before adding concurrency between navigations, it helps to slow down one ordinary navigation.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_single-orchestration.svg" style="width:100%; max-width: 880px; margin: auto;" alt="A single navigation moving through route matching, transaction acquisition, context building, parallel loader flights, pending UI publication, outcome selection, final match publication, and framework render acknowledgements">
<figcaption>
Even one navigation moves along several schedules: loaders run, pending UI may appear, final matches publish, and the framework renders each publication in its own time.
</figcaption>
</figure>

A **lane** is a private, unpublished draft of the matched route branch. Reading from left to right:

1. **Route matching** turns the destination URL into an ordered branch of route matches.
2. The navigation becomes the **current transaction**, giving it permission to publish if it is still current when the work finishes.[^planning]
3. It builds route context and runs `beforeLoad` from parent to child. Children need the completed context of their parents, so this part is intentionally serial.
4. Once that chain is ready, eligible route loaders can run in parallel. Each actual loader invocation is a **loader flight**.
5. If loading takes longer than the route's `pendingMs` duration, the router can publish a pending component. That publication gets its own framework receipt.
6. The lane waits for the loader outcomes it needs, then decides whether the route succeeded, failed, or redirected.
7. If the navigation is still current, it publishes the final matches. The framework receipt settles, and only then may the navigation complete.

> [!NOTE]
> The lane's TypeScript type changes with each phase: `matched`, `contextualized`, `reduced`, then `projected`. A function that publishes a finished lane therefore cannot accidentally receive one that has only been matched. These labels add no runtime state; they let TypeScript enforce the order of the phases.[^lane-phases]

These steps are not one long waterfall but an orchestration of multiple parallel systems: the pending timer races the loaders, normal route components can load alongside them, a framework render can be in progress while the private lane continues toward its final result.

The common client-side path is easier to reason about as four separate tracks, each answering one question and ending on its own schedule. [The next section below](#when-navigations-overlap) explains each concept:

| Owner                                                                               | Decides                                                     | Ends when                              |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| [**Loader flight**](#leases-keep-a-shared-loader-flight-alive)                      | Should this loader invocation stay alive?                   | Its last consumer releases its _lease_ |
| [**Current transaction**](#the-transaction-gates-publishing-not-loading)            | May this navigation publish?                                | A successor replaces its authority     |
| [**Private lane**](#the-lane-reduces-many-outcomes-to-one-result)                   | Did this route attempt succeed, fail, or redirect?          | The lane is accepted or discarded      |
| [**Framework render receipt**](#the-receipt-reports-whether-a-publication-rendered) | May the transition finish, and did this publication render? | The receipt settles or is superseded   |

Most of the time these tracks advance within a few milliseconds of each other. That creates the useful illusion that navigation is one asynchronous task.

## When Navigations Overlap

With navigation concurrency, we can highlight even more interesting cases:

- shared loader work stays alive through leases held by independent consumers;
- losing permission to publish is not the same as losing ownership of that work;
- one loader's outcome is not yet the outcome of the route attempt;
- publishing router state is not proof that the framework rendered it.

Here is the scenario from the video again, this time with the router's own work in view. Read it as one possible interleaving rather than a fixed order: independent events, such as caching `/account` and publishing `/login`, can happen in any order.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_concurrent-orchestration.svg" style="width:100%; max-width: 600px; margin: auto;" alt="A detailed sequence diagram where an account preload and navigation share a loader flight, settings supersedes account, nested settings loaders produce an error and redirect, account data reaches cache, login matches publish, and the framework acknowledges rendering them">
<figcaption>
Replacing the current transaction does not necessarily end a shared loader flight. Loader outcomes first return to a private lane, and published matches cross a separate framework-render boundary.
</figcaption>
</figure>

Now let's zoom in on some of what is happening here.

### Leases Keep a Shared Loader Flight Alive <!-- "lease" explainer -->

Both the _preload_ lane and the _navigation_ lane need `/account`'s data. But the `loader` is only invoked once.

Each still does its own matching, builds its own context, and runs its own `beforeLoad`. That invocation and its outcome are the only things they share: reusing work must not mean inheriting another consumer's draft of the page.

Sharing one invocation raises a question: when is it safe to abort? So the invocation is wrapped in a **flight**: a promise, its abort controller, and a lease count. Every consumer that needs it takes a **lease**.[^flights]

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_mini-lease-explainer.svg" style="width:100%; max-width:430px; margin: auto;" alt="One loader flight shared across three overlapping lease lifetimes, with its lease count rising from one to three and falling back to zero">
<figcaption>
Consumers acquire and release their own claims on one loader invocation. The flight remains owned until the final lease ends.
</figcaption>
</figure>

Acquiring a lease raises the count. Releasing one removes that consumer's claim and nothing else. The flight stays alive while the count is above zero, and can be aborted the moment it reaches zero with the promise still pending.

Preload and navigation lanes, published routes, and cache entries can all hold leases. A lease can outlive the promise it covers because the claim is about the lifetime of the resource, not the delivery of a value.

That is why `/account` still reaches the cache. Clicking `/settings` releases the _navigation_'s lease, but the hover's _preload_ lease is still there. The count never reaches zero, nothing is aborted, and the result is cached when it finally settles.

### The Transaction Gates Publishing, Not Loading <!-- "transaction" explainer -->

While the `/account` navigation lane is pending, `/settings` can take over as the **current transaction**. The transaction is a single slot: only the navigation that holds it can publish. When `/settings` takes it, `/account` loses that right (and attempts a cleanup, possibly aborting flights without a lease).

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_mini-tx-explainer.svg" style="width:100%; max-width:680px; margin: auto;" alt="The /account lane moves through matching, beforeLoad and loaders, checking that it still holds the transaction between stages; /settings then takes the slot, so any /account continuation fails its next check and cannot publish">
<figcaption>
At every async boundary, the lane compares its own transaction with the slot. When `/settings` takes it, `/account` is canceled and the dotted segment can never publish.
</figcaption>
</figure>

Without the transaction, the `/account` lane is guaranteed to never publish its matches. The navigation releases its leases. This in turn may abort the loader flights that have no other leases, but in our example the preload still holds a lease which means the flight continues.

With this single-slot transaction, it becomes very easy to enforce that a lane cannot publish if it is not allowed to:

```ts
if (router._tx !== tx) {
  finishPending(tx)
  discardLane(result)
  return
}
```

### The Lane Reduces Many Outcomes to One Result <!-- "lane" explainer -->

The `/settings` branch runs two loaders. The parent layout loader rejects, and a moment later the child index loader throws `redirect('/login')`.

A settled loader is a fact about one loader, not yet a decision about the route. Those facts go back to the private lane, which **reduces** them into a single outcome.[^reduction]

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_mini-reduce-explainer.svg" style="width:100%;max-width: 550px;margin: auto;" alt="Three settings loaders return a success, an error, and a redirect to login; their outcomes return to the settings lane, which produces one result and continues as the login lane">
<figcaption>
Loader outcomes return to the lane. The lane, not the order the promises settled in, decides what the route did.
</figcaption>
</figure>

An error does not become the lane's result just because it arrives first. Before choosing an ordinary failure, the lane waits for any already-started loaders that could still redirect. It then chooses one result for the whole branch:

- a redirect if any loader asked for one,
- a failure (error or not-found) and the boundary that will render it,
- or a full-lane success.

The redirect wins here, not because it outranks the error, but because it starts another navigation rather than producing UI. The lane still considers the error, but does not select it for display. The `/settings` lane is discarded without ever publishing error UI.

### The Receipt Reports Whether a Publication Rendered <!-- "ack" explainer -->

Publishing means handing a route branch to the framework to render. It is a request, not proof that the branch reached the screen.[^publication-events]

React may still be busy with the previous tree. The new one can suspend on promises of its own (`useSuspenseQuery`, `use(promise)`, `lazy(() => import(...))`, etc.) while React keeps the committed UI on screen. And if another navigation publishes first, the previously published branch may never commit at all.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_mini-ack-explainer.svg" style="width:100%; max-width: 580px; margin: auto;" alt="Two route publications race to render. The first is replaced before it commits and receives a false acknowledgement; the second commits and receives a true acknowledgement">
<figcaption>
Here the second publication replaces the first before it renders, then reaches the screen itself.
</figcaption>
</figure>

To tell these cases apart, the router keeps a single **receipt** slot. When a publication claims it, it first has to answer any receipt already there with `false`, then installing its own. If React commits that publication, the adapter answers its receipt with `true`.[^framework-ack]

Either answer releases the router's wait. The answer changes what may follow:[^pending]

|                                                   | `ack:true` | `ack:false` |
| ------------------------------------------------- | ---------- | ----------- |
| The navigation resolves                           | ✅         | ✅          |
| `onResolved`, if the transaction is still current | ✅         | ✅          |
| `onRendered`                                      | ✅         | ❌          |
| A pending fallback starts its `pendingMinMs`      | ✅         | ❌          |

_Rendered_ here means React committed the tree and ran its layout effects, not necessarily that the browser painted it.

## One Bug Pattern, Many Symptoms

The bugs behind the rewrite surfaced in different APIs and frameworks. Their symptoms varied, but the underlying mistake was often the same: one fact was treated as proof of another.

| What happened                   | What the router inferred                | What went wrong                                                                                                                                                                                                                                                                                |
| ------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A navigation was replaced       | Its loader was no longer needed         | Shared work was canceled while a preload or another navigation still needed it, forcing loaders to restart or preventing preload results from being reused ([#3928](https://github.com/TanStack/router/issues/3928), [#7759](https://github.com/TanStack/router/issues/7759))                  |
| A loader result could be shared | The whole route attempt could be shared | One navigation inherited another's preload state or parent context, so loaders ran with the wrong inputs ([#3179](https://github.com/TanStack/router/issues/3179), [#4572](https://github.com/TanStack/router/issues/4572), [#7602](https://github.com/TanStack/router/issues/7602))           |
| A loader redirected             | The route should render that result     | A redirect reached route UI instead of starting the next navigation ([#7120](https://github.com/TanStack/router/issues/7120), [#7367](https://github.com/TanStack/router/issues/7367), [#7753](https://github.com/TanStack/router/issues/7753))                                                |
| Route state was published       | The route had rendered                  | The router could report that a route rendered even though the framework never committed that publication ([render-owner contract](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/tests/react-render-owner-contract.test.tsx#L21-L101)) |

The fix was to track each decision separately.

## One Valid Page

In the opening scenario, the user ends up on `/login`. The `/account` result still reaches the cache, the `/settings` error never reaches the page, and React decides when `/login` has actually rendered.

We now have an architecture in place that ensures individual facts to now bleed into parallel work. Replacing a navigation does not mean all of its work should stop. A loader error does not necessarily mean error UI. Publishing a route does not mean the framework rendered it.

`navigate()` remains simple because the router orchestrates all those promises.

<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_summary.svg" style="width:100%; max-width: 480px; margin: auto;" alt="One line running from navigate to render, made of four coloured segments that hand over to each other at a node: the current transaction, the private lane, the loader flight, and the framework render">

> [!NOTE]
> The diagrams are a teaching slice, not a complete inventory. Examples in the implementation include preflight planning, pending UI presentation, preload and cache entries, hydration handoff, development HMR rollback, and server request and stream cleanup. Background reloads are another: they keep successful loader data visible while a private candidate runs, then require both their transaction and exact committed base to remain current before publishing.
>
> Other features attach to those boundaries instead of creating one larger navigation owner: lazy component readiness feeds into lane reduction, scroll restoration consumes rendered events, and view transitions wrap publication. Those details are not needed to follow the client navigation above.[^other-lifetimes]

---

[^architecture]: The rewrite's [internal architecture guide](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L53-L86) lists the independent publishing, resource, presentation, preload, hydration, and server authorities. The four tracks in this article cover the common client-side story; they are not the complete inventory.

[^planning]: The diagram compresses planning and execution into one navigation-authority track. In the implementation, a short-lived [`_preflight` owner](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L2017-L2111) protects events and route matching before the foreground transaction is installed.

[^lane-phases]: The [phase-branded lane types](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L135-L159) record how far along the pipeline a lane is, in the type system only. The brand is a compile-time marker that does not exist at runtime, so a function that requires a reduced lane simply will not accept one that has only been matched.

[^reduction]: Before the rewrite, the loader path already [waited for started tasks and preferred redirect control flow](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/router-core/src/load-matches.ts#L1029-L1050). [Regression coverage for that existing behavior](https://github.com/TanStack/router/commit/3a5575627d46e765f7fab2e5488657d2b739273c) includes a [shared-flight variant](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/router-core/tests/loader-architecture-regressions.test.ts#L136-L208). In the new pipeline, [`settleTasks`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1034-L1080) records outcomes and [`reduceLane`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1082-L1215) selects one semantic lane or redirect.

[^flights]: A [`LoaderFlight`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L176-L184) contains one normalized outcome promise, its own abort controller, and a lease count. The [registry and release rules](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L472-L575) keep discoverability separate from ownership.

[^publication-events]: The final client [publication callback](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1956-L1975) commits the matches and emits `onLoad` and `onBeforeRouteMount` before awaiting the framework receipt; [`commitMatches`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1538-L1604) runs the route lifecycle callbacks. [After that receipt settles](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1983-L2013), the router emits `onResolved`, and emits `onRendered` only for a current positive acknowledgement.

[^framework-ack]: Before the rewrite, React's adapter used [global loading and transition flags](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/react-router/src/Transitioner.tsx#L86-L128), while `startTransition` itself [returned no receipt](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/react-router/src/Transitioner.tsx#L13-L32). It now acknowledges the exact offered match-array reference through a [transition owner](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/src/Transitioner.tsx#L9-L46) and a [`Matches` layout effect](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/src/Matches.tsx#L74-L92). Solid awaits [`Solid.startTransition`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/solid-router/src/Transitioner.tsx#L17-L27), while Vue awaits its [render tick](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/vue-router/src/Transitioner.tsx#L12-L17).

[^pending]: The [`PendingSession`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L217-L225) owns one reveal/minimum-visible deadline and its acknowledgement. [`offerPending`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1385-L1523) starts the minimum only after a positive render acknowledgement.

[^other-lifetimes]: The architecture guide's [authority table and code map](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L27-L71) cover client planning, presentation, cache, hydration, refresh, server requests, and accepted streams. Its [background-reload model](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L817-L878) keeps a candidate private and guards publication by transaction and committed-base identity. Normal component chunks participate in [loader readiness](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L919-L950), [scroll restoration subscribes to `onRendered`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/scroll-restoration.ts#L216-L245), and final client publication runs inside the router's [view-transition boundary](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1956-L2013).
