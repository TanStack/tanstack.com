---
title: Announcing TanStack Query v5
published: 2023-10-17
authors:
  - Dominik Dorfmeister
---

About one year ago, we announced the [TanStack Query v5 roadmap](https://github.com/TanStack/query/discussions/4252), and the whole team has been working hard on that version ever since. So we're super happy to announce that today is the day: After 91 alpha releases, 35 betas and 16 release candidates, TanStack Query [v5.0.0](https://github.com/TanStack/query/releases/tag/v5.0.0) is finally here! 🎉

v5 continues the journey of v4, trying to make TanStack Query smaller (v5 is ~20% smaller than v4), better and more intuitive to use. One of the main focus points for this release was around streamlining and simplifying the APIs we offer:

## Breaking changes

As a big breaking change, we've removed most overloads from the codebase, unifying how you use `useQuery` and other hooks. This is something we wanted to do for v4, but a [TypeScript limitation](https://github.com/microsoft/TypeScript/issues/43371) prevented us from doing that. TypeScript addressed this issue in TS 4.7, so we were able to remove all the overloads that we had for calling `useQuery` with a different amount of parameters. This is a huge DX win, because methods with overloads usually have quite bad TypeScript error messages.

This is the biggest breaking change in v5, but we think it's worth it. The API is now much more consistent - you always just pass _one_ object. To alleviate the pain of changing all occurrences manually, we have tried to prepare everyone for this coming change for the last months. The documentation was changed to use the new API, and we released an auto-fixable [eslint rule](/query/v4/docs/eslint/prefer-query-object-syntax) in our eslint package. Additionally, v5 comes with [a codemod](/query/v5/docs/react/guides/migrating-to-v5#codemod) to help with the transition.

Apart from that, we've renamed `cacheTime` to `gcTime` to better reflect what it is doing, merged `keepPreviousData` with `placeholderData`, renamed `loading` states to `pending` and [removed the callbacks](https://github.com/TanStack/query/discussions/5279) from `useQuery`. All these changes make v5 the most consistent and best version for new starters.

To read more about the breaking changes, have a look at our [migration guide](/query/v5/docs/react/guides/migrating-to-v5).

## New Features

Of course, v5 comes loaded with amazing new features as well 🚀:

### Simplified optimistic updates

Enjoy a brand new, simplified way to perform optimistic updates by leveraging the returned `variables` from `useMutation`, without having to write code that updates the cache manually. For more details, have a look at the [optimistic updates documentation](/query/v5/docs/react/guides/optimistic-updates)

### Sharable mutation state

A frequently requested feature, as seen in this [two-year-old issue](https://github.com/TanStack/query/issues/2304), finally comes to life in v5: You can now get access to the state of all mutations, shared across components thanks to the new [useMutationState](/query/v5/docs/react/reference/useMutationState) hook.

### 1st class `suspense` support

That's right - `suspense` for data fetching is no longer experimental, but fully supported. React Query ships with new `useSuspenseQuery`, `useSuspenseInfiniteQuery` and `useSuspenseQueries` hooks. Have a look at the [suspense docs](/query/v5/docs/react/guides/suspense) to learn about the differences to the non-suspense versions.

#### Streaming with React Server Components

v5 also comes with an experimental integration for suspense on the server in nextJs, unifying the best of both worlds: The [react-query-next-experimental](/query/v5/docs/react/guides/advanced-ssr#experimental-streaming-without-prefetching-in-nextjs) adapter allows us to write a single `useSuspenseQuery`, which will initiate data fetching as early as possible: on the server, during SSR. It will then stream the result to the client, where it will be put into the cache automatically, giving us all the interactivity and data synchronization of React Query.

### Improved Infinite Queries

Infinite Queries can now [prefetch multiple pages](/query/v5/docs/react/guides/prefetching) at once, and you have the option to specify the [maximum amount of pages](/query/v5/docs/react/guides/infinite-queries#what-if-i-want-to-limit-the-number-of-pages) stored in the cache as well.

### New Devtools

The Query devtools have been re-written from scratch in a framework-agnostic way to make them available to all adapters. They also got a UI revamp and some new features like cache inline editing and light mode.

### Fine-grained persistence

Another long-standing [discussion from 2021](https://github.com/TanStack/query/discussions/2649) highlights the importance of fine-grained persistence with just-in-time restore capabilities (especially for mobile development) that the `PersistQueryClient` plugin doesn't have. With v5, we now have a new [experimental_createPersister](/query/v5/docs/react/plugins/createPersister) plugin that allows you to persist queries individually.

### The `queryOptions` API

Now that we have a unified way to call `useQuery` (with just one object as parameter), we can also build better abstractions on top of that. The new [queryOptions](/query/v5/docs/react/typescript#typing-query-options) function gives us a type-safe way to share our query definitions between `useQuery`and imperative methods like `queryClient.prefetchQuery`. On top of that, it can make `queryClient.getQueryData` type-safe as well.

---

## THANK YOU

We hope you're going to enjoy using v5 as much as we've enjoyed building it. What's left for us to say thanks to everyone who made this release possible. No matter if you're core contributor, implemented an issue from the roadmap, if you've fixed a typo in the docs or gave feedback on the alpha releases: Every contribution matters! It's the people that makes this library great, and we're blessed to have such an amazing community. ❤️
