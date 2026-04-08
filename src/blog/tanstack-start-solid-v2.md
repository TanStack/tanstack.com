---
title: 'Solid 2.0 Beta Support in TanStack Router and Start'
published: 2026-04-08
excerpt: Solid 2.0 beta support is now available in TanStack Router and TanStack Start, so you can start experimenting with Solid's next major release in real applications today.
authors:
  - Brenley Dueck
---

![Solid 2.0 Beta Support in TanStack Router and Start](/blog-assets/tanstack-router-solid-v2/header.jpg)

Today we're excited to release beta support for the Solid 2.0 beta in TanStack Router and TanStack Start!

Solid 2.0 introduces some genuinely exciting new capabilities, and we wanted to make sure you could try them in real applications, not just small demos. If you're experimenting with Solid 2.0 and need a full-stack app framework, you have come to the right place

## How to Use it Today

You can try it today in one of two ways:

- Start from one of our [Solid examples](https://github.com/TanStack/router/tree/solid-router-v2-pre/examples/solid)
- Upgrade an existing TanStack Router or TanStack Start app to the beta versions below

If you're upgrading an existing app, update your dependencies to:

```bash
pnpm add @tanstack/solid-router@^2.0.0-beta.10 @tanstack/solid-start@^2.0.0-beta.11 solid-js@2.0.0-beta.5 @solidjs/web@2.0.0-beta.5
pnpm add -D vite-plugin-solid@3.0.0-next.4
```

Or in `package.json`:

```json
{
  "dependencies": {
    "@tanstack/solid-router": "^2.0.0-beta.10",
    "@tanstack/solid-start": "^2.0.0-beta.11",
    "solid-js": "2.0.0-beta.5",
    "@solidjs/web": "2.0.0-beta.5"
  },
  "devDependencies": {
    "vite-plugin-solid": "3.0.0-next.4"
  }
}
```

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
