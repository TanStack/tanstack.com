# Redact Vinext and Next.js launch

Prepared October 25, 2026. The announcement, release summary, and posts below are ready for publication after the package is released and its published integrations are verified. No announcement has been sent or scheduled.

The audience is developers who already use React with TanStack Start, Vite, Vinext, or Next.js and want smaller client bundles without rewriting their components. Lead with framework support, then show the measured size difference and explain the scheduling tradeoff.

## Release checks

The release candidate now carries maintained framework corrections in Redact. It does not require another upstream release. The existing required checks still decide readiness.

| Check                                                        | Current evidence                                                                                           | Required next step                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [Redact release](https://github.com/TanStack/redact/pull/52) | 1,859 runtime tests, types, packaging, and all 38 size gates pass                                          | Require the final PR and publication checks to pass              |
| Vinext and Cloudflare                                        | All 102 local configurations and 1,410 scenarios pass, plus all 18 hosted configurations and 282 scenarios | Retain the final package and lockfile evidence                   |
| Next.js compatibility                                        | All 162 configurations and 2,694 scenarios pass across six versions                                        | Retain the required complete matrix gate                         |
| Dependency security                                          | Undici 7.30.1 and fflate 0.7.5 pass their regressions, final consumer audit has zero vulnerabilities       | Retain both documented overrides and the final lockfile          |
| Landing page and announcement                                | Final benchmark and compatibility evidence incorporated                                                    | Publish after the package is available and verify the live pages |

The final benchmark retains the 39.4 KB gzip client saving. Production build times are effectively equal; local development startup improved by 2.2% for App Router and 4.9% for the large Pages fixture. Browser rendering speed was not measured.

The [adapter docs](https://github.com/TanStack/redact/blob/taren/stable-framework-support/docs/vinext.md) explain the owned Cloudflare integration and package-manager overrides. The [upstream evidence](https://github.com/TanStack/redact/blob/taren/stable-framework-support/benchmarks/upstream/README.md) preserves the original failures and contributions. Keep all supported versions, tests, and size limits.

## Publish in this order

1. Confirm the final PR passes its existing required checks and retains the complete package, browser, framework, deployment, and hosted evidence, using its maintained adapters and documented dependency overrides. Confirm the default Vite bundle stays at or below 23,335 gzip bytes and the full client stays at or below 28,183.
2. Merge the compatibility PR after its required checks pass. Let Changesets create the version PR, validate and merge it through the normal workflow, and verify the resulting npm version and exports. Install it in fresh consumers and confirm both documented integrations work. Changesets currently plans version 0.2.0, confirm the actual version from the release PR.
3. Reconcile the final published versions and evidence with the docs, landing page, and announcement. If the dependency or runtime changes affect the measured app, refresh the benchmark before reusing its numbers. Remove the pending-release paragraph from `RedactLanding.tsx`, remove the unpublished-release notice from the article, set its actual publication date, and set `draft: false`. Keep the statement about synchronous rendering.
4. Publish the [website PR](https://github.com/TanStack/tanstack.com/pull/1422). Verify the live landing page, both setup guides, the benchmark link, and the announcement before directing readers to them.
5. Use the release summary and publish the X thread below. Each launch link points back to TanStack.
6. During the first day, collect reproducible reports with framework version, router, bundler, development or production mode, and native React behavior. Link existing issues where possible. Fix root causes through the normal release process.
7. Two or three days later, share the side-by-side Next.js journey. A week later, publish a real app's measured result if one is available, including route, compression, dependencies, and scheduling tradeoffs. Keep the measured Vinext fixture clearly identified until then.

The final preview was reviewed at 390 px and 1280 px with the frozen candidate. Framework tabs, hot edits, content rebuilds, and fresh server renders passed. Website type and lint checks pass.

## Announcement

The website draft is [Redact for Vinext and Next.js](../src/blog/redact-nextjs-vinext.md). Its intended URL is `https://tanstack.com/blog/redact-nextjs-vinext`. The draft remains unlisted, but this site's draft URLs can be opened directly, so its visible release notice stays in place until launch.

The existing landing page is the main launch destination: `https://tanstack.com/redact/latest`. Framework setup stays in the existing docs. GitHub release notes link to those same guides and evidence.

## Release summary

Redact adds stable browser integrations for Vinext and Next.js, covering App Router and Pages Router. Keep your React imports and dependencies. Native React continues to handle server rendering and Server Components, while Redact hydrates and renders in the browser.

In the measured Vinext app, Redact reduced all emitted client JavaScript and CSS from 154.9 KB to 115.5 KB gzip, including lazy routes. Production build times were effectively equal. Browser rendering and hydration speed were not measured. Redact renders synchronously, without React's time slicing or interruptible component renders.

[Start and Vite setup](https://tanstack.com/redact/latest/docs/vite-plugin) · [Vinext setup](https://tanstack.com/redact/latest/docs/vinext) · [Next.js setup](https://tanstack.com/redact/latest/docs/next) · [Compatibility](https://tanstack.com/redact/latest/docs/compatibility) · [Benchmark](https://github.com/TanStack/redact/blob/main/benchmarks/VINEXT_BENCHMARKS.md)

## X thread

Post 1:

```text
Redact now supports Vinext and Next.js, including App Router and Pages Router.

Keep your components and React imports, use a smaller browser runtime. React stays on the server.

https://tanstack.com/redact/latest?utm_source=x&utm_medium=social&utm_campaign=redact-next-vinext
```

Post 2:

```text
In Vinext's benchmark app, Redact cut emitted client JS + CSS from 154.9 KB to 115.5 KB gzip. That's 25.4% smaller across six builds.

This includes lazy routes, not one page's download. Build times were effectively equal. Browser rendering speed wasn't measured.
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

Use the site's existing page views and campaign parameters. Compare the seven days after launch with the preceding seven days for Redact landing visits and visits to the Vinext and Next.js guides. Track confirmed compatibility reports and their resolution separately. npm downloads provide background context, they do not identify which framework someone used or prove a successful migration.

## Claim checks

| Claim                             | Evidence and limit                                                                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 39.4 KB / 25.4% less output       | [Vinext benchmark](https://github.com/TanStack/redact/blob/main/benchmarks/VINEXT_BENCHMARKS.md), same app and dependencies, all emitted client JS and CSS including lazy routes, six builds                                                                                    |
| 39.2 KB / 27.2% less entry output | Same report, browser entry plus eager JavaScript imports, not every possible route request                                                                                                                                                                                      |
| Starter app bundle charts         | [Four-framework measurements](./benchmarks/redact-frameworks/README.md), same counter and input: Start saves 47.0 KB / 43.0%, Vite 48.1 KB / 70.5%, Vinext 39.3 KB / 28.5%, and Next.js 35.7 KB / 20.4%. All emitted client JS and CSS, gzip, one production build per variant. |
| Performance                       | Build times were effectively equal. Local startup was 2.2% faster for App Router and 4.9% faster for the large Pages fixture. Browser and server rendering speed were not measured                                                                                              |
| Framework coverage                | [Vinext report](https://github.com/TanStack/redact/blob/main/benchmarks/VINEXT_COVERAGE.md) and [Next.js report](https://github.com/TanStack/redact/blob/main/benchmarks/NEXT_COVERAGE.md), all required cases must pass before the stable announcement                         |
| Rendering tradeoff                | [Compatibility guide](https://tanstack.com/redact/latest/docs/compatibility), synchronous rendering with no time slicing or interruptible component renders                                                                                                                     |

Reply to requests for a universal Next.js percentage with the app-specific distinction above. Reply to scheduling questions with the actual rendering tradeoff. Avoid claims of universal React parity or faster hydration.
