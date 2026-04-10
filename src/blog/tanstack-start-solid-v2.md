---
title: 'Solid 2.0 Beta Lands in TanStack Router, Start, and Query'
published: 2026-04-10
excerpt: Solid 2.0 beta support has landed in TanStack Router, Start, and Query, so you can start building and experimenting with Solid's next major release today.
authors:
  - Brenley Dueck
  - Birk Skyum
---

![Solid 2.0 Beta Lands in TanStack Router, Start, and Query](/blog-assets/tanstack-start-solid-v2/header.png)

Solid 2.0 beta support has landed in TanStack Router, Start, and Query.

Solid 2.0 introduces major changes to async rendering, derived state, and SSR, and we wanted to make sure you could try those changes in real applications right away, not just isolated demos. If you're evaluating Solid 2.0 and want routing, server rendering, and data fetching ready to go, you can start today.

## Get Started Today

You can get started in one of two ways:

- Start from one of our [Solid examples](https://github.com/TanStack/router/tree/solid-router-v2-pre/examples/solid)
- Upgrade an existing TanStack Router or TanStack Start app to the beta versions below

If you're upgrading an existing app, update these dependencies first:

<!-- ::start:tabs variant="package-manager" mode="install" -->

solid: @tanstack/solid-router@^2.0.0-beta.11 @tanstack/solid-start@^2.0.0-beta.12 @tanstack/solid-router-devtools@^2.0.0-beta.8 solid-js@^2.0.0-beta.5 @solidjs/web@^2.0.0-beta.5

<!-- ::end:tabs -->

<!-- ::start:tabs variant="package-manager" mode="dev-install" -->

solid: vite-plugin-solid@^3.0.0-next.4

<!-- ::end:tabs -->

If you use TanStack Query, also add:

<!-- ::start:tabs variant="package-manager" mode="install" -->

solid: @tanstack/solid-query@^6.0.0-beta.3 @tanstack/solid-query-devtools@^6.0.0-beta.3 @tanstack/solid-router-ssr-query@^2.0.0-beta.12

<!-- ::end:tabs -->

The TanStack APIs are mostly unchanged. The main breaking changes come from Solid 2.0 itself, so if you're upgrading an existing Solid app, read the official [Solid 2.0 migration guide](https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/MIGRATION.md).

## Why This Matters

Solid 2.0 is more than a version bump. It opens up patterns that were awkward or impossible to express cleanly before, especially around async behavior, derived state, and SSR.

That matters most in larger applications, where routing, loading states, and server rendering carry real weight. TanStack Router and TanStack Start are a natural fit there, and we wanted Solid users to be able to explore the new release now instead of waiting for app-level tooling to catch up.

Some of the highlights in Solid 2.0 include:

- Fine-grained non-nullable async
- Mutable derivations
- Derived signals
- Pull-based run-once SSR
- Pending UI as an expression

If you want to dig deeper into the release itself, check out the [Solid 2.0 beta discussion](https://github.com/solidjs/solid/discussions/2596) and the [Road to 2.0 discussion](https://github.com/solidjs/solid/discussions/2425).

## Still Early — We Want Your Feedback

This support is intentionally early. We'd rather put Solid 2.0 support in your hands while the beta is still evolving than wait until every edge case is polished.

If you try TanStack Router, Start, or Query with Solid 2.0 beta, tell us what works, what feels rough, and where the integration breaks down. Early feedback here is what helps us make the release solid quickly.

[Join the Discord](https://tlinz.com/discord) and tell us what worked, what felt rough, and what you'd like to see next.
