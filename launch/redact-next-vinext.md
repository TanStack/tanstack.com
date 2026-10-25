# Redact Next.js and Vinext launch

Prepared October 25, 2026. Publication is on hold. The announcement, release summary, and posts below are for use after the published package passes the existing release gates. No announcement has been sent or scheduled.

The audience is developers who already use React with Next.js, Vinext, or Vite and want smaller client bundles without rewriting their components. Lead with framework support, then show the measured size difference and explain the scheduling tradeoff.

## Release dependencies

| Dependency                                                                                                              | Status on October 25                 | Required next step                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| [Redact release](https://github.com/TanStack/redact/pull/52)                                                            | Held by required framework checks    | Pass the complete matrices with published, unpatched dependencies    |
| [Cloudflare security fix](https://github.com/cloudflare/workers-sdk/pull/16476)                                         | Merged                               | Verify patched stable packages are published and used by the fixture |
| [Cloudflare development evaluator](https://github.com/cloudflare/workers-sdk/pull/16466)                                | Open                                 | Merge, publish, and verify the real Worker development journeys      |
| [Vinext dependency optimizer](https://github.com/cloudflare/vinext/pull/4268)                                           | Open                                 | Merge, publish, and verify installed-package behavior                |
| [Vinext Pages data redirects](https://github.com/cloudflare/vinext/pull/4299)                                           | Open                                 | Merge, publish, and verify Pages navigation state                    |
| [Next.js 16.2 source backport](https://github.com/tannerlinsley/next.js/tree/taren/backport-next-162-development-cache) | Tested, awaiting upstream acceptance | Obtain a published 16.2 patch, then pass the original Firefox cases  |

Cloudflare's development fix has 87 successful checks and three skipped checks on commit `6ae1ed8`. npm still serves Cloudflare Vite plugin 1.65.0, Wrangler 4.152.0, and Vinext 1.3.0 as of 09:16 UTC on October 25. The patched stable tooling has not shipped.

The [upstream evidence](https://github.com/TanStack/redact/blob/taren/stable-framework-support/benchmarks/upstream/README.md) tracks the full diagnostic history. A merged fix or a passing source backport does not clear the published-package gate. Preserve the current supported versions, all tests, and both size limits.

## Publish in this order

1. Update fixture pins to the upstream releases containing the fixes. Run the existing complete package, browser, framework, deployment, and hosted checks. Confirm the default Vite bundle stays at or below 23,335 gzip bytes and the full client stays at or below 28,183.
2. Merge the compatibility PR after its required checks pass. Let Changesets create the version PR, validate and merge it through the normal workflow, and verify the resulting npm version and exports. Install it in fresh consumers and confirm both documented integrations work. The expected minor release is 0.2.0, confirm the actual version from automation.
3. Reconcile the final published versions and evidence with the docs, landing page, and announcement. If the dependency or runtime changes affect the measured app, refresh the benchmark before reusing its numbers. Remove the pending-release paragraph from `RedactLanding.tsx`, remove the draft notice from the article, set its actual publication date, and set `draft: false`. Keep the statement about synchronous rendering.
4. Publish the [website PR](https://github.com/TanStack/tanstack.com/pull/1422). Verify the live landing page, both setup guides, the benchmark link, and the announcement before directing readers to them.
5. Use the release summary and publish the X thread below. Each launch link points back to TanStack.
6. During the first day, collect reproducible reports with framework version, router, bundler, development or production mode, and native React behavior. Link existing issues where possible. Fix root causes through the normal release process.
7. Two or three days later, share the side-by-side Next.js journey. A week later, publish a real app's measured result if one is available, including route, compression, dependencies, and scheduling tradeoffs. Keep the measured Vinext fixture clearly identified until then.

## Announcement

The website draft is [Redact for Next.js and Vinext](../src/blog/redact-nextjs-vinext.md). Its intended URL is `https://tanstack.com/blog/redact-nextjs-vinext`. The draft remains unlisted, but this site's draft URLs can be opened directly, so its visible release notice stays in place until launch.

The existing landing page is the main launch destination: `https://tanstack.com/redact/latest`. Framework setup stays in the existing docs. GitHub release notes link to those same guides and evidence.

## Release summary

Redact adds stable browser integrations for Next.js and Vinext, covering App Router and Pages Router. Keep your React imports and dependencies. Native React continues to handle server rendering and Server Components, while Redact hydrates and renders in the browser.

In the measured Vinext app, Redact reduced all emitted client JavaScript and CSS from 154.9 KB to 115.5 KB gzip, including lazy routes. Production builds took about 18 ms longer. Browser rendering and hydration speed were not measured. Redact renders synchronously, without React's time slicing or interruptible component renders.

[Next.js setup](https://tanstack.com/redact/latest/docs/next) · [Vinext setup](https://tanstack.com/redact/latest/docs/vinext) · [Compatibility](https://tanstack.com/redact/latest/docs/compatibility) · [Benchmark](https://github.com/TanStack/redact/blob/main/benchmarks/VINEXT_BENCHMARKS.md)

## X thread

Post 1:

```text
Redact now supports Next.js and Vinext, including App Router and Pages Router.

Keep your components and React imports, use a smaller browser runtime. React stays on the server.

https://tanstack.com/redact/latest?utm_source=x&utm_medium=social&utm_campaign=redact-next-vinext
```

Post 2:

```text
In Vinext's benchmark app, Redact cut emitted client JS + CSS from 154.9 KB to 115.5 KB gzip. That's 25.4% smaller across six builds.

This includes lazy routes, not one page's download. Builds took 18 ms longer. We didn't measure browser rendering speed.
```

Post 3:

```text
Redact renders synchronously, without React's time slicing or interruptible renders. A heavy render can still delay input.

Suspended transitions, pending forms, and optimistic state are covered. The scheduling tradeoff matters, so try your own busiest screen.
```

## Journey follow-up

Use the existing `pnpm example:next:journey` demo from the released Redact source. Show React and Redact side by side through navigation, an optimistic save, validation, comments, and returning to the original page. Keep the renderer labels visible and record actual browser behavior at normal playback speed. This demonstrates behavior, not latency or frame-rate equivalence.

Caption:

```text
Same Next.js app, React and Redact side by side: navigation, an optimistic save, server validation, comments, and back again.

The comparison app is in the repo so you can run it yourself.

https://tanstack.com/blog/redact-nextjs-vinext?utm_source=x&utm_medium=social&utm_campaign=redact-next-vinext
```

After release, an optional shared walkthrough with a Vinext contributor could use this same demo and the reproducible benchmark. The invitation should ask for their technical perspective, with no implied endorsement. Prepare any outreach for explicit approval before sending it.

## Measure adoption

Use the site's existing page views and campaign parameters. Compare the seven days after launch with the preceding seven days for Redact landing visits and visits to the Next.js and Vinext guides. Track confirmed compatibility reports and their resolution separately. npm downloads provide background context, they do not identify which framework someone used or prove a successful migration.

## Claim checks

| Claim                             | Evidence and limit                                                                                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 39.4 KB / 25.4% less output       | [Vinext benchmark](https://github.com/TanStack/redact/blob/main/benchmarks/VINEXT_BENCHMARKS.md), same app and dependencies, all emitted client JS and CSS including lazy routes, six builds                                                            |
| 39.2 KB / 27.2% less entry output | Same report, browser entry plus eager JavaScript imports, not every possible route request                                                                                                                                                              |
| Next.js savings                   | App-specific. The benchmark's 74.5 KB comparison changes both framework and renderer, so it cannot establish Redact-only savings in Next.js                                                                                                             |
| Performance                       | The measured build was 1.9% slower, startup differences were inconclusive, browser and server rendering speed were not measured                                                                                                                         |
| Framework coverage                | [Next.js report](https://github.com/TanStack/redact/blob/main/benchmarks/NEXT_COVERAGE.md) and [Vinext report](https://github.com/TanStack/redact/blob/main/benchmarks/VINEXT_COVERAGE.md), all required cases must pass before the stable announcement |
| Rendering tradeoff                | [Compatibility guide](https://tanstack.com/redact/latest/docs/compatibility), synchronous rendering with no time slicing or interruptible component renders                                                                                             |

Reply to requests for a universal Next.js percentage with the app-specific distinction above. Reply to scheduling questions with the actual rendering tradeoff. Avoid claims of universal React parity or faster hydration.
