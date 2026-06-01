---
published: 2026-06-02
authors:
  - Manuel Schiller
title: 'TanStack Start Adds First-Class Rsbuild Support'
excerpt: 'TanStack Start now supports Rsbuild 2 alongside Vite, so teams can choose the build tool that best fits their stack, preferences, and infrastructure.'
library: start
---

![React Server Components](/blog-assets/start-adds-rsbuild-support/header.jpg)

TanStack Start now supports Rsbuild 2 alongside Vite, giving teams two supported build-tool paths for Start.

Some teams prefer Vite. Some prefer Rsbuild because it is built on Rspack, feels familiar to teams with Webpack experience, or matches how the rest of their frontend infrastructure is organized. The new adapter makes that choice explicit: Start fits into either build tool through its plugin system.

For a React app, the config looks like this:

```ts title='rsbuild.config.ts'
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

export default defineConfig({
  plugins: [pluginReact(), tanstackStart()],
})
```

React and Solid are supported today, and because the Rsbuild work lives at Start's shared build layer, future framework adapters have the same path available to them.

Rsbuild owns the build, while the framework plugin handles React or Solid and `tanstackStart()` wires Start into both the client and server builds. If you have used Start with Vite, the pattern is intentionally familiar because the Start build-tool plugins are designed to fit naturally into the toolchain you choose.

## Why another build tool matters

Build-tool choice is not just an implementation detail, because it shapes plugins, dev server behavior, production output, CI assumptions, and the weird little conventions that accumulate around a frontend stack.

That matters for new apps when a team simply prefers Rsbuild, and it matters even more when the team is not starting from an empty repo. Existing applications often come with Webpack or Rspack infrastructure, internal conventions, and build assumptions that are expensive to revisit during a framework migration. Rsbuild support lets those teams adopt Start without making build-tool change part of the same step.

Rsbuild support gives both groups the same thing: a way to evaluate Start through a toolchain they already trust, whether they are choosing Rsbuild for a new app or moving existing apps toward Start. One large company is already using the adapter while moving several apps from a Webpack setup to Start on Rsbuild, where keeping the build tool familiar helps narrow the migration scope.

## The two-adapter rule

There is a pattern we keep running into at TanStack: the first adapter proves something can work, and the second adapter shows which parts actually belong in the core.

TanStack Router and TanStack Start already went through this once at the UI framework layer, where adding Solid made the React assumptions easier to see and improved the shared core. Adding Rsbuild brought the same clarity to the build layer.

Because the first Start build adapter was Vite, some build logic naturally grew around Vite's plugin lifecycle, and adding Rsbuild made the boundary sharper: shared Start build behavior in one place, build-tool-specific behavior in the Vite and Rsbuild adapters.

## The Rsbuild adapter has full feature parity

The Rsbuild adapter supports the full Start feature set, including:

- React and Solid apps
- Server Functions
- SSR and streaming SSR
- HMR
- import protection
- React Server Components for React apps

## Built with the Rsbuild and Rspack team

The TanStack team built the adapter in close collaboration with the Rsbuild and Rspack team, and the work fed back into both projects.

One example came from the Start templates, which use CSS `?url` imports to reference emitted stylesheet URLs. While we were working through compatibility, the Rsbuild team added the missing support so that template pattern works across both adapters.

Another example came from React Server Components. Rspack's RSC support was initially shaped around a full-app RSC model, while Start uses RSC in a more fine-grained way across routes, SSR, and Server Functions. That meant the adapter needed Rspack APIs for client/server coordination and asset handling, including the client component chunks and CSS associated with an RSC payload. The Rspack team implemented the pieces needed on their side, which made their RSC support more general in the process.

## Your build tool, your choice

Choosing Start should let a team keep its preferred build tool. With Vite and Rsbuild both supported, teams can use the toolchain that fits their stack while building the same kind of Start app.

Teams that prefer Rsbuild, or already work in the Webpack and Rspack world, now get a native Start integration through Rsbuild's plugin system.

The Rsbuild adapter is available now. Try it in a new Rsbuild project or in an existing codebase moving to Start.
