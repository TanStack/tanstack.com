---
title: Redact for Next.js and Vinext
published: 2026-10-25
draft: true
excerpt: Keep your React components and imports, use a smaller browser runtime. App Router and Pages Router, with React still running on the server.
authors:
  - Tanner Linsley
library: redact
---

> This release isn't published yet. [Follow the release](https://github.com/TanStack/redact/pull/52).

Redact's Next.js and Vinext integrations let you keep your components, hooks, and React imports while swapping in a smaller browser runtime. That includes App Router and Pages Router, even if your app only uses Pages Router.

React still handles server rendering and Server Components. Your framework still owns routing, caching, and Server Action transport. Redact hydrates the HTML and runs your client components in the browser.

## 39.4 KB less client output

We ran Vinext's benchmark suite with React and Redact on the same app, with the same dependencies, for six measured rounds each.

| Gzipped client output                      |    React |   Redact |
| ------------------------------------------ | -------: | -------: |
| All emitted JavaScript and CSS             | 154.9 KB | 115.5 KB |
| Browser entry and eager JavaScript imports | 144.2 KB | 105.0 KB |

That's **25.4% less total client output**, with identical sizes across all six builds. The total includes lazy routes, so it isn't the download for a single page. KB here means 1,000 bytes.

These are Vinext measurements. They don't establish the savings for every Next.js app. The [full report](https://github.com/TanStack/redact/blob/main/benchmarks/VINEXT_BENCHMARKS.md) includes the workloads, versions, raw results, and a separate Next.js baseline.

Production build times were effectively equal. Development startup was 2.2% faster for App Router and 4.9% faster for the large Pages fixture in this local run. This suite didn't time browser rendering, hydration, responsiveness, or production SSR throughput.

## Add the integration

Install `@tanstack/redact` and keep your React dependencies. Your component imports stay the same.

For Next.js, wrap your existing configuration:

```js
// next.config.mjs
import { withRedact } from '@tanstack/redact/next'

export default withRedact({
  // Your existing Next.js options
})
```

The wrapper configures Turbopack and Webpack. The accepted release lines are Next.js 15.5 and 16.0 through 16.4. Prereleases and untested minor versions are rejected. The [Next.js guide](/redact/latest/docs/next) has the pinned versions and coverage details.

For Vinext, add Redact after `vinext()`:

```js
// vite.config.ts
import { defineConfig } from 'vite'
import vinext from 'vinext'
import { redact } from '@tanstack/redact/vinext'

export default defineConfig({
  plugins: [vinext(), redact()],
})
```

Keep React, React DOM, and React Server DOM installed. Both framework integrations leave the server on React, so don't change `jsxImportSource` to Redact. See the [Vinext guide](/redact/latest/docs/vinext) for its dependency pins. Existing Vite apps can keep using the [Vite integration](/redact/latest/docs/vite-plugin).

## What happens when the app gets busy?

Redact renders synchronously. It doesn't have React's time slicing or interruptible component renders, so a long render can still hold up input. If your app relies on that scheduling behavior, this is a tradeoff to evaluate in your own app.

Suspended transitions can keep the current screen visible. Forms can show pending state, optimistic changes can commit or roll back, and streamed content can arrive as it's ready. The [compatibility guide](/redact/latest/docs/compatibility) spells out the differences.

The browser suites exercise hydration and DOM identity, navigation and history, streamed Suspense, Server Actions, optimistic state, Cache Components, errors, and Fast Refresh. They use native React controls and run in Chromium, Firefox, and WebKit. The full reports show every configuration and retain failures: [Next.js](https://github.com/TanStack/redact/blob/main/benchmarks/NEXT_COVERAGE.md), [Vinext](https://github.com/TanStack/redact/blob/main/benchmarks/VINEXT_COVERAGE.md).

To compare an actual user journey, the repository includes the same Next.js app running with React and Redact side by side. It walks through navigation, an optimistic save, server validation, comments, and returning to the original page. From a repository checkout, run:

```sh
pnpm install
pnpm example:next:journey
```

Open the local URL printed by the runner, then use the [framework setup guides](/redact/latest/docs/installation) to try Redact in your own app.
