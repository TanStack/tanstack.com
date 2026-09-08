---
title: TanStack + Unkey Partnership
published: 2025-04-24
updated: 2026-09-08
rss: false
excerpt: Unkey supports TanStack's work on controlling application workload, with API keys and server-side rate limits.
library: pacer
authors:
  - Tanner Linsley
---

![TanStack + Unkey](/blog-assets/unkey-partnership/header.png)

A search box can debounce input, but that doesn't stop someone from calling the API directly. Keeping an app responsive and deciding how much work its server will accept are related problems, and they need controls in different places.

We're welcoming Unkey as a TanStack partner alongside our work on TanStack Pacer! Pacer gives you tools like debouncing, throttling, and queuing inside your application. Unkey provides API key management and server-side rate limiting, where you can enforce access and usage limits on incoming requests.

For example, an app can use Pacer to avoid sending a request for every keystroke, then check a caller's rate limit on the server before doing expensive work. The client makes the interaction smoother, and the server remains responsible for enforcing the limit.

Thanks to Unkey for supporting TanStack. Their [rate limiting guide](https://www.unkey.com/docs/platform/ratelimiting/introduction) covers that server-side piece, and our [Unkey partner page](/partners/unkey) also links to the API key setup.
