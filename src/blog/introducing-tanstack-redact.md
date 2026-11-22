---
title: Introducing TanStack Redact
published: 2026-10-26
excerpt: A smaller replacement for React and React DOM in the browser. Keep your application code and ship less JavaScript.
draft: false
authors:
  - Tanner Linsley
library: redact
socialImage: /blog-assets/introducing-tanstack-redact/header.jpg
---

![TanStack Redact](/blog-assets/introducing-tanstack-redact/banner.jpg)

TanStack Redact is a smaller replacement for React and React DOM in the browser. It implements the React APIs your app uses to render and update its UI, so you can ship less JavaScript without changing a single line of application code. You add it to your build configuration, and your existing React imports, components, hooks, and dependencies use Redact in the browser.

It works with TanStack Start, Vite, Vinext, and Next.js. With Vinext and Next.js, React stays on the server while Redact handles hydration and rendering in the browser. Redact renders synchronously, so it doesn't include React's time slicing or interruptible rendering.

When I wrote [Projecting React](https://tannerlinsley.com/posts/projecting-react), I was pretty explicit about how far I wanted to take Redact. I wanted to see if a smaller implementation of the React APIs we used could work on my personal site and tanstack.com, and I was willing to keep it very specific to those two sites.

Well, the experiment stuck, and we've ended up using it a lot.

It's been really good for us, and enough other people are using it in production now that keeping it as a little experiment on the side doesn't make much sense anymore. We depend on it, other people depend on it, and we think it's worth maintaining and continuing to improve.

Redact 0.2.0 is out, with stable browser integrations for TanStack Start, Vite, Vinext, and Next.js. Vinext and Next.js cover both App Router and Pages Router, including apps that only use Pages Router. Add Redact to your build configuration and ship a smaller browser runtime without changing a single line of application code.

The compatibility work is what made this release possible. React's API is a much bigger contract than getting a counter to increment, especially once you bring hydration, navigation, Suspense, forms, optimistic updates, and framework internals into it. We expanded the coverage and fixed the failures, and kept both runtime bundles within their existing size limits while doing it.

For Vinext and Next.js, React still handles server rendering and Server Components. The framework still owns routing, caching, and Server Action transport. Redact takes over hydration and client rendering, so you can keep using the framework you already chose.

## What you save

We built the same small app with React and Redact in each framework, then added up the gzip size of all emitted client JavaScript and CSS.

| Framework      |    React |   Redact |          Saved |
| -------------- | -------: | -------: | -------------: |
| TanStack Start | 109.3 KB |  62.3 KB | 47.0 KB, 43.0% |
| Vite           |  68.3 KB |  20.1 KB | 48.1 KB, 70.5% |
| Vinext         | 138.1 KB |  98.8 KB | 39.3 KB, 28.5% |
| Next.js        | 175.6 KB | 139.9 KB | 35.7 KB, 20.4% |

Those are the default Redact builds. Start and Vite can go smaller when you disable optional features your app and its dependencies don't use. In this example, Start gets down to 59.8 KB and the client-only Vite app gets down to 12.6 KB.

These are whole-build totals, including lazy chunks, so the percentages will change with your app and they aren't a promise about one page's download. The [measurements and source](https://github.com/TanStack/redact/tree/40fffcb7dd4cca1d2011dfecad995db260d6f809/benchmarks/framework-bundles) are available if you want to reproduce them.

We also ran [Vinext's benchmark](https://github.com/TanStack/redact/blob/main/benchmarks/VINEXT_BENCHMARKS.md) over six rounds. That app went from 154.9 KB to 115.5 KB, a 39.4 KB reduction. Production build times were effectively the same, and development startup was a little faster. That benchmark doesn't measure browser rendering or hydration speed, so I wouldn't turn those results into a claim that every interaction gets faster.

There is a real scheduling tradeoff here. Redact renders synchronously, without React's time slicing or interruptible component renders. Suspended transitions, pending forms, and optimistic state are covered, but a heavy render can still delay input. You'll want to try it against your own app's busiest screens, and the [compatibility guide](https://tanstack.com/redact/latest/docs/compatibility) explains the boundaries.

## We still believe in React

I expect React to keep growing and doing good things for the internet. There's an enormous amount of useful software built on it, and people are going to keep choosing it for good reasons. I'm also excited about Solid and Octane and where they're going, and I want those projects to succeed too.

In the meantime, most of the people we work with have apps to maintain, components they like, and things they still want to build. A smaller implementation that lets them keep that work has value, even while the rest of the ecosystem keeps moving.

I think there's plenty of nobility in working toward a smaller, faster React for the people and agents who choose to use it. Redact gives us a place to do that work, with compatibility as the thing we have to keep earning.

You can try 0.2.0 with [TanStack Start](https://tanstack.com/redact/latest/docs/start), [Vite](https://tanstack.com/redact/latest/docs/vite-plugin), [Vinext](https://tanstack.com/redact/latest/docs/vinext), or [Next.js](https://tanstack.com/redact/latest/docs/next). Bring your app, measure what changes, and tell us where the compatibility needs more work.
