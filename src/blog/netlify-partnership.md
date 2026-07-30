---
title: TanStack + Netlify Partnership
published: 2025-03-18
excerpt: Netlify is an official hosting partner for TanStack Start, with a Vite integration for deploying full-stack apps and an official starter template.
authors:
  - Tanner Linsley
---

![Netlify Header](/blog-assets/netlify-partnership/header.jpg)

**Netlify is an official hosting partner for TanStack Start.** The practical result is a supported deployment path through [`@netlify/vite-plugin-tanstack-start`](https://www.npmjs.com/package/@netlify/vite-plugin-tanstack-start), including SSR, Server Routes, Server Functions, middleware, and local Netlify platform emulation.

## TanStack Start on Netlify

Netlify’s Vite integration configures TanStack Start for its full-stack runtime while keeping the usual Vite development loop. Git-based continuous deployment creates Deploy Previews for pull and merge requests. Teams can also enable branch deploys for selected or all non-production branches.

Netlify also maintains a [full-stack TanStack Start chat template](https://github.com/netlify-templates/tanstack-template) built with TanStack Router, TanStack Store, Claude, and optional Sentry and Convex integrations. You can deploy that template directly, or create a new Netlify-ready project with the TanStack CLI:

```bash
npx @tanstack/cli create my-app --deployment netlify
```

The CLI installs and configures the Netlify deployment target, so the generated project is ready for the Netlify CLI or a Git-connected deployment.

## Deploy a TanStack Start app

For a new project, use the command above and follow the generated setup. For an existing app, add the Netlify Vite plugin and deploy with `npx netlify deploy`.

- [TanStack Start hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting#netlify--official-partner)
- [Netlify’s TanStack Start template](https://github.com/netlify-templates/tanstack-template)

Netlify’s support helps fund TanStack’s open-source work while giving Start users a deployment path maintained by both teams.
