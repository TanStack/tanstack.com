---
published: 2026-08-05
draft: true
authors:
  - Florian Pellet
title: 'Inside a TanStack Router Navigation'
excerpt: 'A navigation looks like one asynchronous operation. Inside TanStack Router, separate owners coordinate matching, loaders, pending UI, redirects, caching, and rendering.'
library: router
---

![A flock of seagulls racing toward an island](/blog-assets/tanstack-router-loading-lifetimes/header.png)

From application code, a navigation looks almost too simple:

```ts
await router.navigate({ to: '/account' })
```

One call, one promise, one destination.

Now imagine that the user hovers the link first. The router starts preloading `/account`. They click while its loader is still running, so the navigation joins the work that the hover already started.

Before it finishes, they click `/settings`. That route has a layout and an index child, with a loader on each. The layout loader fails, but the index loader redirects to `/login`.

Meanwhile, the `/account` loader is still useful to the preload. Its result can enter the cache even though `/account` is no longer where the user is going. The router eventually publishes `/login`, then waits for the framework to catch up.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_simple-scenario.svg" width="720" alt="A timeline where an account preload is joined by a navigation, a later settings navigation starts layout and index loaders, the index loader redirects to login, account data also enters the cache, and the framework acknowledges login after publication">
<figcaption>
Even this simplified timeline has work being shared, superseded, redirected, cached, published, and rendered on different schedules.
</figcaption>
</figure>

Which result is allowed to reach the page? Which loader should be canceled? Does the first error win? Is the navigation finished when router state changes, or when the framework renders it?

Those questions do not have one shared answer.

We learned this the hard way. [A rewrite of TanStack Router's match-loading core](https://github.com/TanStack/router/pull/7805) fixed 27 linked regressions across preloading, redirects, caching, pending UI, SSR, and more. They looked unrelated, but most crossed the same boundary: one part of the router was answering a question that belonged to another.

The new model assigns separate owners to publishing, route outcomes, loader work, and rendering. There is still one `navigate()` call at the API boundary, but there is no single owner of everything inside it.[^architecture]

## Even One Navigation Is an Orchestration

Before adding concurrency between navigations, it helps to slow down one ordinary navigation.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_single-orchestration.svg" width="720" alt="A single navigation moving through route matching, transaction acquisition, context building, parallel loader flights, pending UI publication, outcome selection, final match publication, and framework render acknowledgements">
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

Most of the time these tracks advance within a few milliseconds of each other. That creates the useful illusion that navigation is one asynchronous task.

Overlap is where the illusion breaks.

## When Navigations Overlap

Now we can replay the opening scenario with the owners visible. Time runs from top to bottom.

<figure>
<img src="/blog-assets/tanstack-router-loading-lifetimes/nav-orchestra_concurrent-orchestration.svg" width="720" alt="A detailed sequence diagram where an account preload and navigation share a loader flight, settings supersedes account, nested settings loaders produce an error and redirect, account data reaches cache, login matches publish, and the framework acknowledges rendering them">
<figcaption>
Replacing the current transaction does not necessarily end a shared loader flight. Loader outcomes first return to a private lane, and published matches cross a separate framework-render boundary.
</figcaption>
</figure>

The final publish arrow compresses two checks: the private lane selects the result, then the current transaction confirms that it may publish. A loader flight cannot publish a destination by itself.

### Supersession Is Not Cancellation

Hovering `/account` creates a speculative lane and starts its loader flight. The preload owns a lease on that flight, but it is not the current transaction and cannot publish `/account` to the page.

Clicking `/account` creates a separate private lane. It builds its own context and guards, then can share the preload's loader flight instead of invoking the loader twice. Only the loader invocation is shared, not the rest of the lane.

Once `/settings` becomes current, `/account` can no longer publish, so that navigation releases its lease. The preload still has a lease, so the loader keeps running and can populate the cache.

A newer navigation revokes permission to publish. It does not cancel loader work that another consumer still needs.

A loader flight can also outlive its promise. An accepted or cached match may keep its lease after the loader returns. Ownership ends only when the last consumer releases it.

The `/account` cache write and the `/login` publication are independent. Either can happen first; their relative order is not part of the route decision.

### A Loader Settles; the Lane Decides

The `/settings` layout and index loaders can run concurrently once their parent-first context work is complete.

The layout loader fails first. That failure is recorded, but it does not automatically determine the outcome of the entire lane. It cannot decide the route by itself.

The index loader then redirects to `/login`. Redirects are control flow: they tell the route attempt to continue somewhere else. The redirect therefore wins over the earlier error. The settings error never reaches the page; the router continues with a new `/login` lane.

If the router had published the first rejected promise immediately, the user could briefly see the settings error before being sent to login. If it had canceled every descendant on the first error, it might never discover the redirect.

Loader settlement produces evidence. The private lane selects what that evidence means for this route attempt.

### The Router Publishes; the Framework Acknowledges

Once the `/login` lane has a final result, the current transaction can publish its `matches` to observable router state. That is a request to present `/login`, not proof that `/login` is already in the DOM.

React might still have an older tree suspended. Solid may still be inside a transition. Vue may still be waiting for its render tick. The framework adapter therefore returns a receipt for each publication.[^framework-ack]

The receipt can settle because the framework transition ended even if that exact publication never rendered. A positive acknowledgement is stricter: it confirms that the requested `matches` appeared. The router uses that stronger signal for `onRendered` and pending UI timing.

Pending UI follows the same rule. If `pendingMs` expires, the router can publish a pending presentation, but `pendingMinMs` starts only after the framework confirms that the fallback rendered. A fallback superseded before it appears adds no artificial delay.[^pending]

Publishing asks the framework to render. The acknowledgement reports what happened.

## One Bug Pattern, Many Symptoms

The 27 regressions linked from the rewrite were not 27 copies of one bug. They appeared in different APIs and across different framework adapters. The recurring mistake was treating one owner's fact as proof for another owner's decision.

| Mistaken shortcut                            | What can go wrong                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superseded transaction means canceled flight | A successor aborts a shared loader flight while a preload or accepted match still needs it ([preload adoption contract tests](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/tests/preload-navigation-adoption.test.ts))          |
| Shared flight means shared whole lane        | A cached `cause` or `preload` flag leaks into a navigation, or fresh parent context never reaches a child ([#3179](https://github.com/TanStack/router/issues/3179), [#7602](https://github.com/TanStack/router/issues/7602))                                                             |
| First rejected loader means render an error  | A parent error reaches the page before an already-running child redirect is considered ([regression test](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/tests/loader-architecture-regressions.test.ts#L627))                     |
| Published router state means rendered UI     | An older suspended render acknowledges a newer publication, attaching completion to the wrong tree ([render-owner contract test](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/tests/react-render-owner-contract.test.tsx#L21)) |

Before asynchronous work can publish, the implementation re-checks its owner. Lane phases are explicit in TypeScript, loader flights track leases and cancellation, and framework adapters acknowledge the exact publication they rendered.

The result is not more serialization. It is explicit coordination between work that remains concurrent.

> [!NOTE]
> These diagrams deliberately leave out server loading and hydration, lazy route and pending components, scroll restoration, and view transitions. Each adds another lifetime or coordination boundary, but follows the same ownership model.

## A Useful Mental Model

From the outside, `navigate()` should continue to feel like one operation. That API is useful precisely because the router coordinates the parts underneath it.

When those parts overlap, ask four independent questions:

1. Which transaction may still publish?
2. What outcome did this private lane select?
3. Who still owns each loader flight?
4. Did the framework finish the transition, and did this publication actually render?

The mistake was asking one owner to answer another owner's question.

A navigation is not one asynchronous task. It is an orchestration of independent lifetimes that must agree on one valid result.

---

[^architecture]: The rewrite's [internal architecture guide](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/INTERNALS.md#L53-L86) lists the independent publishing, resource, presentation, preload, hydration, and server authorities. The four tracks in this article cover the common client-side story; they are not the complete inventory.

[^planning]: The diagram compresses planning and execution into one navigation-authority track. In the implementation, a short-lived [`_preflight` owner](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L2017-L2111) protects events and route matching before the foreground transaction is installed.

[^reduction]: [`settleTasks`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1034-L1080) records ordinary failures while preserving redirect control flow from started descendants. [`reduceLane`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1082-L1215) turns those outcomes into one semantic lane or redirect.

[^flights]: A [`LoaderFlight`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L176-L184) contains one normalized outcome promise, its own abort controller, and a lease count. The [registry and release rules](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L472-L575) keep discoverability separate from ownership.

[^framework-ack]: React acknowledges the exact offered match-array reference through its [transition owner](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/src/Transitioner.tsx#L9-L46) and a [`Matches` layout effect](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/react-router/src/Matches.tsx#L74-L92). Solid awaits [`Solid.startTransition`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/solid-router/src/Transitioner.tsx#L17-L27), while Vue awaits its [render tick](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/vue-router/src/Transitioner.tsx#L12-L17).

[^pending]: The [`PendingSession`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L217-L225) owns one reveal/minimum-visible deadline and its acknowledgement. [`offerPending`](https://github.com/TanStack/router/blob/45c4ad8d629e291fab70c37900525449e415ffcd/packages/router-core/src/load-client.ts#L1385-L1523) starts the minimum only after a positive render acknowledgement.
