---
title: 'Solid 2.0 Beta Support in TanStack Router, Start and Query'
published: 2026-04-10
excerpt: Solid 2.0 beta support is now available in TanStack Router, Start and Query, so you can start experimenting with Solid's next major release in real applications today.
authors:
  - Brenley Dueck
  - Birk Skyum
---

![Solid 2.0 Beta Support in TanStack Router, Start and Query](/blog-assets/tanstack-start-solid-v2/header.png)

Today we're excited to release support for the Solid 2.0 beta in TanStack Router, Start and Query!

Solid 2.0 introduces some genuinely exciting new capabilities, and we wanted to make sure you could try them in real applications, not just small demos. If you're experimenting with Solid 2.0 and need a full-stack app framework, you have come to the right place.

## How to Use It Today

You can try it today in one of two ways:

- Start from one of our [Solid examples](https://github.com/TanStack/router/tree/solid-router-v2-pre/examples/solid)
- Upgrade an existing TanStack Router or TanStack Start app to the beta versions below

If you're upgrading an existing app, update your dependencies to:

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

The TanStack APIs are mostly unchanged, but Solid 2.0 itself includes breaking changes. If you're upgrading an existing Solid app, make sure to read the official [Solid 2.0 migration guide](https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/MIGRATION.md).

## Why This Matters

Solid 2.0 is a major step forward for the framework. It unlocks capabilities that were difficult or impossible to express cleanly before, especially around async behavior, derived state, and SSR.

That makes this a great time to try Solid in larger applications, where routing, loading states, and server rendering start to matter a lot more. TanStack Router and TanStack Start are a natural fit there, and we wanted Solid users to be able to explore the new release without waiting around for app-level tooling to catch up.

Some of the highlights in Solid 2.0 include:

- Fine-grained non-nullable async
- Mutable derivations
- Derived signals
- Pull-based run-once SSR
- Pending UI is an expression

If you want to dig deeper into what's changing in Solid itself, check out the [Solid 2.0 beta discussion](https://github.com/solidjs/solid/discussions/2596) and the [Road to 2.0 discussion](https://github.com/solidjs/solid/discussions/2425).

## Still Early, Please Tell Us What Breaks

This support is still early, and that's exactly why we want feedback now. If you try TanStack Router or TanStack Start with Solid 2.0 beta, let us know how it goes.

[Join the Discord](https://tlinz.com/discord) and tell us what worked, what felt rough, and what you'd like to see next.
