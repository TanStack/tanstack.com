---
title: TanStack + Electric Partnership
published: 2025-05-25
updated: 2026-09-08
rss: false
excerpt: Electric and TanStack are building TanStack DB together, bringing reactive queries and Postgres sync into the same workflow.
library: db
authors:
  - Tanner Linsley
---

![TanStack + Electric](/blog-assets/electric-partnership/header.png)

I've wanted developers to be able to work with their data as naturally as if it were already local. Electric's Kyle Mathews and I found a lot of common ground there, especially around making that experience something you can adopt a little at a time.

That shared direction became our work together on TanStack DB. Electric brings Postgres sync, and TanStack DB gives applications collections, live queries, and optimistic mutations to work with that data. Sam Willis's work on the reactive query engine helped make the pieces fit together.

The result is useful in a very ordinary interaction: someone changes a record, and the views that depend on it update. Your components query collections, while the sync integration keeps those collections current. You can also bring data from existing APIs into DB, so trying this doesn't require replacing your entire backend.

Electric's [July 2025 introduction to the collaboration](https://electric.ax/blog/2025/07/29/super-fast-apps-on-sync-with-tanstack-db) walks through how it came together. For the current API and setup, see the [Electric collection guide](/db/latest/docs/collections/electric-collection).

I'm grateful to Kyle, Sam, and the Electric team for building this with us!
