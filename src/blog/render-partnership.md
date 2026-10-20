---
title: TanStack + Render Partnership
published: 2026-09-01
updated: 2026-09-08
rss: false
excerpt: Render joins TanStack to make shipping full-stack apps easier, with managed services and versioned infrastructure.
library: start
authors:
  - Tanner Linsley
---

![TanStack + Render](/blog-assets/render-partnership/header.png)

We're teaming up with Render to make it easier to get a TanStack app into production and keep building once it's there. Render is supporting TanStack as a Gold partner, helping fund the open-source tools that go into those apps.

A Start app might begin with a few routes and a database. Later, you add a background worker, a cache, or another service. Render gives those pieces a home together, with managed Postgres, Redis-compatible Key Value, and private networking between services. You can spend more of your time on the application as it grows.

The deployment path is concrete, too. TanStack Start runs as a Node web service on Render, and a `render.yaml` Blueprint lets you keep the service configuration in the same repository as your code. Pull request previews give you somewhere to check a change before shipping it.

Thanks to the Render team for backing TanStack and working with us on that path!

Our [Render deployment walkthrough](/partners/render) covers the setup, from creating the app to deploying its first Blueprint.
