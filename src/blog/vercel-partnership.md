---
title: TanStack + Vercel Partnership
published: 2026-09-08
excerpt: Vercel is a Gold TanStack partner, supporting our open-source work with integrations for TanStack Start, AI Gateway, and Sandbox.
library: start,ai
authors:
  - Tanner Linsley
---

![TanStack + Vercel](/blog-assets/vercel-partnership/header.png)

**Vercel is now a Gold TanStack partner!** Their support helps fund our open-source work, and there are already a few ways to use the two together, from deploying a TanStack Start app to running model calls and coding agents with TanStack AI.

## TanStack Start on Vercel

You can deploy a full-stack TanStack Start app on Vercel, with Git-based deployments and preview URLs for reviewing changes before they go live. Vercel's [TanStack Start deployment guide](https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel) covers the setup, and our [hosting guide](/start/latest/docs/framework/react/guide/hosting) has the configuration details alongside the other deployment options Start supports.

## Vercel AI Gateway

The [`@tanstack/ai-vercel-gateway` adapter](/ai/latest/docs/adapters/vercel-gateway) connects TanStack AI to Vercel AI Gateway for chat, embeddings, image generation, and summarization. You can route requests across model providers with one API key and configure provider preferences and fallback models per request, while keeping TanStack AI's existing chat and streaming APIs.

Vercel's [AI Gateway guide](https://vercel.com/kb/guide/tanstack-ai-vercel-ai-gateway) covers authentication, streaming a chat response, and configuring those routing options.

## Vercel Sandbox

Model calls are one part of building an agent, giving it somewhere to run commands and edit files is another. [`@tanstack/ai-sandbox-vercel`](https://vercel.com/kb/guide/tanstack-ai-vercel-sandbox) plugs Vercel's managed microVMs into TanStack AI's sandbox system, so you can choose where an agent runs separately from which agent you use.

The integration supports resuming a sandbox by ID with its files intact and exposing a dev server port for previews. Your workspace definition stays with TanStack AI, and Vercel provides the environment it runs in.

Thanks to the Vercel team for supporting TanStack and putting these guides together. You can find the deployment and AI integration docs on our [Vercel partner page](/partners/vercel).
