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

Now imagine that several things happen before that navigation can finish.

<video src="/blog-assets/tanstack-router-loading-lifetimes/tanstack-router-navigation-demo.mp4" autoplay muted loop playsinline controls></video>

1. Hovering `/account` starts preloading it.
2. Clicking `/account` reuses the loading work that the hover started.
3. Before it finishes, the user clicks `/settings`, whose route loaders run in parallel.
4. One `/settings` loader errors while another redirects to `/login`.
5. The earlier `/account` work finishes and is cached, even though the user is no longer going there.
6. The router publishes `/login`, but its content suspends.
7. The framework eventually renders `/login`.

This is what this scenario would look like on a timeline. Don't worry about the labels yet, the rest of the article will explain them.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_simple-scenario.svg" style="width:100%; max-width: 800px; margin: auto;" alt="A timeline where an account preload is joined by a navigation, a later settings navigation starts layout and index loaders, the index loader redirects to login, account data also enters the cache, and the framework acknowledges login after publication">
<figcaption>
Account loading, the redirect to login, caching, and rendering proceed on different schedules.
</figcaption>
</figure>

Why can `/account` keep loading after the user moves on? Why can it no longer update the page? Why does the `/settings` error never reach the page? Why is publishing `/login` not the end of the navigation?

Those questions do not have one shared answer. **A navigation looks like one asynchronous operation, but the router must decide four things independently: which loading work should continue, which navigation may publish, what the route attempt decided, and whether the framework rendered it.**

We learned this while [rewriting TanStack Router's loading system](https://github.com/TanStack/router/pull/7805). Dozens of bugs across preloading, redirects, caching, pending UI, SSR, and more looked unrelated. Many had the same cause: an event that answered one question was treated as proof of another. Cancellation, supersession, publication, and rendering were allowed to stand in for each other.[^lifetime-bugs]

Application code still sees one `navigate()` call. Inside the router, separate lifetimes track each of those four answers.[^architecture]

## Start With One Successful Navigation

Before returning to the opening scenario, strip away the second navigation, error, and redirect. The next diagram shows one successful navigation that loads slowly enough to display pending UI.

Some labels name internal steps, don't worry we're decoding just after. Each row follows a different part of the navigation. The arrows between rows are handoffs: loaders can run while a pending timer races them, and the framework can render pending UI while the private route branch continues loading.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_single-orchestration.svg" style="width:100%; max-width: 880px; margin: auto;" alt="A single navigation moving through route matching, transaction acquisition, context building, parallel loader flights, pending UI publication, outcome selection, final match publication, and framework render acknowledgements">
<figcaption>
One successful navigation still moves along several schedules: loaders run, pending UI may appear, final matches publish, and the framework handles each publication in its own time.
</figcaption>
</figure>

A **lane** is a private, unpublished draft of the matched route branch. In this successful case:

1. **Route matching** turns the destination URL into an ordered branch of route matches.
2. The navigation becomes the **current transaction**. This is what grants it permission to publish if it is still current when the work finishes.[^planning]
3. The private lane builds route context and runs `beforeLoad` from parent to child. A child `beforeLoad` needs their parents' completed context, so this part is intentionally serial.
4. Eligible route loaders can then run in parallel. Each actual loader invocation is a **loader flight**.
5. If the loaders take longer than `pendingMs`, the router can publish pending UI. The framework handles that publication while the private lane keeps loading.
6. When the loader outcomes are ready, the lane selects the successful result.
7. Because this navigation is still current, it publishes the final matches. The framework acknowledges that publication, and the navigation can finish.

> [!NOTE]
> The diagram's `release flight` label marks where the lane releases its temporary claim. That does not necessarily end ownership of settled data. The loader-flight section below explains why.

This example is deliberately uneventful. No other navigation replaces its transaction. No loader errors or redirects. Both the pending and final publications render successfully.

Now add one complication to each row:

| What changes?                                                        | The router keeps it separate with                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Another consumer needs a loader that is already running.             | A [**loader flight** and its leases](#a-replaced-navigation-can-leave-useful-work)        |
| The user starts another navigation before this one finishes.         | The [**current transaction**](#only-the-current-navigation-may-publish)                   |
| Parallel loaders produce different kinds of outcomes.                | A [**private lane**](#one-loader-result-is-not-the-route-result)                          |
| Another publication replaces this one before the framework renders it. | A [**framework render receipt**](#published-does-not-mean-rendered)                     |

Most of the time, all four answers arrive within a few milliseconds of each other. That creates the useful illusion that navigation is one asynchronous task. But it is still enough for events to happen at any stage of this navigation.

## When Navigations Overlap

The opening scenario puts all four complications together. The next diagram is a map for the four sections that follow, not a sequence to memorize.

Unlike the other diagrams, read this one from **top to bottom**. Each column follows one owner: the current transaction, a private lane, a loader flight, or the framework render. Horizontal arrows hand work or results from one owner to another. It shows one possible interleaving; independent events, such as caching `/account` and publishing `/login`, can happen in either order.

<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_concurrent-orchestration.svg" style="width:100%; max-width: 600px; margin: auto;" alt="A detailed sequence diagram where an account preload and navigation share a loader flight, settings supersedes account, nested settings loaders produce an error and redirect, account data reaches cache, login matches publish, and the framework acknowledges rendering them">

At a high level, the hover and click create separate `/account` lanes that use the same loader flight. `/settings` then takes over permission to publish, but the preload keeps the `/account` flight alive. The `/settings` loaders return an error and a redirect to their private lane; the redirect starts a new navigation to `/login`, so the `/settings` lane never publishes its final matches. Meanwhile, `/account` can enter the cache. Finally, `/login` publishes and waits for the framework to report that it rendered.

This is our general scenario, now we can zoom in on each boundary.

### A Replaced Navigation Can Leave Useful Work <!-- "lease" explainer -->

In the successful navigation above, each loader had one consumer. In the opening scenario, both the hover preload and the navigation need `/account`'s data. The `loader` should still run only once.

The preload and navigation still do their own matching, build their own context, and run their own `beforeLoad`. They share only the loader invocation and its outcome. Reusing work must not mean inheriting another consumer's draft of the page.

To decide when that shared invocation can be aborted, the router wraps it in a **flight**: a promise, an abort controller, and a lease count. Every consumer that needs the flight takes a **lease**.[^flights]

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_mini-lease-explainer.svg" style="width:100%; max-width:430px; margin: auto;" alt="One loader flight shared across three overlapping lease lifetimes, with its lease count rising from one to three and falling back to zero">
<figcaption>
Consumers acquire and release their own claims on one loader invocation. The flight remains owned until the final lease ends.
</figcaption>
</figure>

This generic diagram shows three consumers. Each owner line is one lease, and the numbers are the total lease count. Acquiring a lease raises the count. Releasing one removes only that consumer's claim. If the count reaches zero while the promise is still pending, the router can abort the flight.

Back in the opening scenario, clicking `/settings` ends the `/account` navigation's claim. The preload still holds its own lease, so the count does not reach zero. The flight continues and its result enters the cache when it settles.

Losing permission to publish `/account` therefore does not prove that its loader is no longer useful. The transaction answers whether `/account` may publish. The flight's leases answer whether the loader is still needed.

> [!NOTE]
> Preload and navigation lanes, published routes, and cache entries can all hold leases. A lease can also outlive the promise it covers: the lease represents ownership of the resource, not a promise lifecycle.

### Only the Current Navigation May Publish <!-- "transaction" explainer -->

In the successful navigation, one transaction remained current from its acquisition through publication. In the opening scenario, `/settings` starts while the `/account` navigation lane is still pending.

The **current transaction** is a single slot. Only the navigation that occupies it may publish. When `/settings` takes the slot, the `/account` navigation loses that right. This change says nothing by itself about whether an independent consumer still needs one of its loader flights.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_mini-tx-explainer.svg" style="width:100%; max-width:680px; margin: auto;" alt="The /account lane moves through matching, beforeLoad and loaders, checking that it still holds the transaction between stages; /settings then takes the slot, so any /account continuation fails its next check and cannot publish">
<figcaption>
At each async boundary, the lane compares its transaction with the current slot. THe first few checks pass, but when `/settings` takes the slot, the next check fails, so the `/account` lane loses publication authority and the dotted segment can never publish.
</figcaption>
</figure>

The discarded navigation releases its leases. Pending flights with no other consumers may now abort, but the `/account` preload still has a lease. Its shared flight continues.

The rule is narrow: the current transaction controls which navigation may publish. It does not control how long shared loader work remains useful.

> [!NOTE]
> The implementation check is deliberately small. At an asynchronous boundary, a lane that no longer holds the slot cleans up and returns instead of publishing:
>
> ```ts
> if (router._tx !== tx) {
>   finishPending(tx)
>   discardLane(result)
>   return
> }
> ```

### One Loader Result Is Not the Route Result <!-- "lane" explainer -->

In the successful navigation, every loader contributes to one successful result. The `/settings` lane is less tidy. The diagram below shows three loaders: one succeeds, the parent layout loader rejects, and the child index loader throws `redirect('/login')`.

A settled loader tells us what happened to that loader. It does not yet tell us what the whole route attempt should do. Each outcome returns to the private lane, which **reduces** them into one result.[^reduction]

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_mini-reduce-explainer.svg" style="width:100%;max-width: 550px;margin: auto;" alt="Three loaders return a success, an error, and a redirect to one private lane, which reduces them to a single outcome">
<figcaption>
Loader outcomes return to the lane. One settled error cannot decide the route result while another started loader could still redirect.
</figcaption>
</figure>

The error does not become the lane's result merely because it settles first. Before choosing an ordinary failure, the lane waits for already-started loaders that could still redirect. This does not mean settlement order never matters: it can help choose among ordinary failures, but it cannot end the route attempt while a started loader might still redirect. The lane then chooses one result for the whole branch:

- A redirect starts a new navigation.
- A failure selects the error or not-found boundary that will render it.
- A success makes the complete lane eligible to publish.

The redirect is not a higher-priority piece of UI than the error. It is control flow: it discards the `/settings` lane and starts a new navigation to `/login`. Because that lane never publishes its final matches, the error never reaches the page. (However the `/settings` pending UI may already have been published while its loaders were running.)

> [!NOTE]
> The lane's TypeScript type changes with each phase: `matched`, `contextualized`, `reduced`, then `projected`. These labels help ensure that the lane goes through each stage in the correct order without adding runtime states.[^lane-phases]

### Published Does Not Mean Rendered <!-- "ack" explainer -->

In the successful navigation, both the pending and final publications render. The opening scenario adds another delay: `/login` publishes, but its content suspends.

Publishing means handing a route branch to the framework. It is a request to render, not proof that the framework committed that branch.[^publication-events]

React may still be busy with the previous tree. The new one can suspend on promises of its own (`useSuspenseQuery`, `use(promise)`, `lazy(() => import(...))`, etc.) while React keeps the committed UI on screen. And if another navigation publishes in the meantime, the previously published branch may never commit at all.

The next diagram is a generic race between two publications. It is not showing `/settings` publishing error UI: the redirect discarded that lane before it could publish its final matches.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_mini-ack-explainer.svg" style="width:100%; max-width: 580px; margin: auto;" alt="Two route publications race to render. The first is replaced before it commits and receives a false acknowledgement; the second commits and receives a true acknowledgement">
<figcaption>
The second publication replaces the first before it commits, then commits successfully itself.
</figcaption>
</figure>

To tell these cases apart, the router keeps a single **receipt** slot. A new publication acknowledges (`ack`) the previous receipt with `false` before installing its own. If React commits the new publication, the adapter acknowledges its receipt with `true`.[^framework-ack]

`ack:false` does not mean the navigation failed. It means that exact publication was replaced before it committed. Either answer settles the receipt, but only `ack:true` proves that the framework rendered the publication.

> [!NOTE]
> The receipt belongs to one exact publication. Either answer releases the internal render wait, but the meaning is changes based on the value:
> |                                                        | `ack:true` | `ack:false` |
> | ------------------------------------------------------ | ---------- | ----------- |
> | The navigation resolves                                | ✅         | 🤷          |
> | `onResolved`, if the transaction is still current      | ✅         | ✅          |
> | `onRendered`                                           | ✅         | ❌          |
> | A pending fallback starts its `pendingMinMs`[^pending] | ✅         | ❌          |
>
> A superseded public `navigate()` can remain chained to the navigation that replaced it, so `ack:false` does not guarantee that the navigation resolves.


_Rendered_ here means that React committed the tree and ran its layout effects. It does not necessarily mean that the browser painted it.

## Keeping Navigation Lifetimes Separate

In the opening scenario, the user ends up on `/login`, but four separate decisions produce that result. The `/account` loader continues because its preload still holds a lease. The `/account` and `/settings` lanes cannot publish their final matches after their transactions are replaced. The `/settings` lane observes an error, but its redirect starts a new `/login` navigation instead of producing UI. Finally, the framework reports when the `/login` publication actually commits.

A navigation can remain one promise in application code because TanStack Router does not treat it as one lifetime internally. A lease says whether loader work is still needed. The current transaction says which navigation may publish. A private lane decides what one route attempt did. A receipt reports whether the framework rendered a publication.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_summary.svg" style="width:100%; max-width: 480px; margin: auto;" alt="A line from navigate to render containing four colors for the current transaction, private lane, loader flight, and framework render receipt">
<figcaption>
The four colors summarize the independent answers that carry one `navigate()` call to render. Their lifetimes can overlap.
</figcaption>
</figure>

Each event answers one question, and nothing more.

> [!NOTE]
> These four lifetimes we have seen here are a teaching slice, not a complete inventory. The implementation also separates preflight planning, pending UI presentation, preload and cache entries, hydration handoff, development HMR rollback, server request cleanup, and stream ownership. Background reloads keep successful loader data visible while a private candidate runs, then require both their transaction and exact committed base to remain current before publishing.
>
> Other features attach to those boundaries instead of creating one larger navigation owner: lazy component readiness feeds into lane reduction, scroll restoration consumes rendered events, and view transitions wrap publication. Those details are not needed to follow the client navigation above.[^other-lifetimes]

---

[^architecture]: The rewrite's [internal architecture guide](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L53-L86) lists the independent publishing, resource, presentation, preload, hydration, and server authorities. The four tracks in this article cover the common client-side story; they are not the complete inventory.

[^lifetime-bugs]: Examples include shared loader work being canceled when a navigation was replaced ([#3928](https://github.com/TanStack/router/issues/3928), [#7759](https://github.com/TanStack/router/issues/7759)), route attempts sharing state that only their loader result could safely share ([#3179](https://github.com/TanStack/router/issues/3179), [#4572](https://github.com/TanStack/router/issues/4572), [#7602](https://github.com/TanStack/router/issues/7602)), redirects reaching route UI ([#7120](https://github.com/TanStack/router/issues/7120), [#7367](https://github.com/TanStack/router/issues/7367), [#7753](https://github.com/TanStack/router/issues/7753)), and published state being reported as rendered before the framework committed it ([render-owner contract](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/tests/react-render-owner-contract.test.tsx#L21-L101)).

[^planning]: The diagram compresses planning and execution into one navigation-authority track. In the implementation, a short-lived [`_preflight` owner](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L2017-L2111) protects events and route matching before the foreground transaction is installed.

[^lane-phases]: The [phase-branded lane types](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L135-L159) record how far along the pipeline a lane is, in the type system only. The brand is a compile-time marker that does not exist at runtime, so a function that requires a reduced lane simply will not accept one that has only been matched.

[^reduction]: Before the rewrite, the loader path already [waited for started tasks and preferred redirect control flow](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/router-core/src/load-matches.ts#L1029-L1050). [Regression coverage for that existing behavior](https://github.com/TanStack/router/commit/3a5575627d46e765f7fab2e5488657d2b739273c) includes a [shared-flight variant](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/router-core/tests/loader-architecture-regressions.test.ts#L136-L208). In the new pipeline, [`settleTasks`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1034-L1080) records outcomes and [`reduceLane`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1082-L1215) selects one semantic lane or redirect.

[^flights]: A [`LoaderFlight`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L176-L184) contains one normalized outcome promise, its own abort controller, and a lease count. The [registry and release rules](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L472-L575) keep discoverability separate from ownership.

[^publication-events]: The final client [publication callback](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1956-L1975) commits the matches and emits `onLoad` and `onBeforeRouteMount` before awaiting the framework receipt; [`commitMatches`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1538-L1604) runs the route lifecycle callbacks. [After that receipt settles](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1983-L2013), the router emits `onResolved`, and emits `onRendered` only for a current positive acknowledgement.

[^framework-ack]: Before the rewrite, React's adapter used [global loading and transition flags](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/react-router/src/Transitioner.tsx#L86-L128), while `startTransition` itself [returned no receipt](https://github.com/TanStack/router/blob/2cb221cfd3b95f55498b22e76e9ac96a32cd26d4/packages/react-router/src/Transitioner.tsx#L13-L32). It now acknowledges the exact offered match-array reference through a [transition owner](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/src/Transitioner.tsx#L9-L46) and a [`Matches` layout effect](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/src/Matches.tsx#L74-L92). Solid awaits [`Solid.startTransition`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/solid-router/src/Transitioner.tsx#L17-L27), while Vue awaits its [render tick](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/vue-router/src/Transitioner.tsx#L12-L17).

[^pending]: The [`PendingSession`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L217-L225) owns one reveal/minimum-visible deadline and its acknowledgement. [`offerPending`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1385-L1523) starts the minimum only after a positive render acknowledgement.

[^other-lifetimes]: The architecture guide's [authority table and code map](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L27-L71) cover client planning, presentation, cache, hydration, refresh, server requests, and accepted streams. Its [background-reload model](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L817-L878) keeps a candidate private and guards publication by transaction and committed-base identity. Normal component chunks participate in [loader readiness](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L919-L950), [scroll restoration subscribes to `onRendered`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/scroll-restoration.ts#L216-L245), and final client publication runs inside the router's [view-transition boundary](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1956-L2013).
