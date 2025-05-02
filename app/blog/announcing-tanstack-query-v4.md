---
title: Announcing TanStack Query v4
published: 2022-07-14
authors:
  - Dominik Dorfmeister
---

We're excited to announce the next version of [TanStack Query](/query/v4), previously known as `react-query` 🎉.
The rebranding and restructuring to a monorepo now finally allows us to bring the joy of `react-query` to other frameworks, like `vue`, `svelte` or `solid`.

TanStack Query is built upon an agnostic core with framework specific adapters on top of it. This allows us to share the core logic that make TanStack Query awesome like the QueryClient or Query Subscriptions between frameworks, while also having framework specific code like hooks (useQuery and useMutation) inside adapters.

## How to install

```
npm i @tanstack/react-query
# or
yarn add @tanstack/react-query
```

## New Features

### Proper offline support

v4 has evolved TanStack Query from a data-fetching library to a true async state manager. All assumptions that were previously taken about having to have an active network connection are now gone, so TanStack Query _really_ works with any Promise, no matter how you produce it.
To achieve this, we've introduced a brand new [Network Mode](/query/v4/docs/guides/network-mode) that helps TanStack Query to decide when queries should respect being online or not.

### Stable Persisters

Since v3, persisters existed as an experimental feature. They allow you to sync the Query Cache to an external location (e.g. localStorage) for later use. We have revamped and improved the APIs after getting lots of feedback, and we are now providing two main peristers out of the box:

- SyncStoragePersister
- AsyncStoragePersister

Those persisters works pretty well for most use-cases, but nothing stops you from writing your own persister - as long it adheres to the required interface.

### Support for React 18

React 18 was released earlier this year, and v4 now has first class support for it and the new concurrent features it brings. To achieve that, internal subscriptions were re-written to leverage the new `useSyncExternalStore` hook.

### Tracked Queries per default

Tracked Queries are a performance optimization that were added in v3.6.0 as an opt-in feature. This optimization is now the default behaviour in v4, which should give you a nice boost in render performance.

### Streamlined APIs

Over time, some of our APIs have become quite complex, to the extent that they were contradicting each other. Some examples include:

- QueryKeys sometimes being converted to an Array when exposed, sometimes not.
- Query Filters being unintuitive and mutually exclusive.
- Default values for parameters defaulting to opposite values on different methods

We've cleaned up a lot of these inconsistencies to make the developer experience even better. v4 also comes with a codemod to help you with the migration path.

## What's next?

Cleaning up the docs, for one. As you might have noticed, they are still pretty react specific and reference `react-query` from time to time. Please bear with us as we aim to restructure the docs, and PRs are always welcome.

Also, more adapters. Currently, only the React adapter exists, but we are eager to add more frameworks soon.
