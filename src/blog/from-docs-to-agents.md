---
title: 'From Docs to Agents: Shipping Knowledge That Travels With Your Package'
published: 2026-03-04
authors:
  - Sarah Gerrard
  - Kyle Matthews
---

![From Docs to Agents](/blog-assets/from-docs-to-agents/header.png)

Your docs are good. Your types are solid. Your agent still gets it wrong.

Not because it's dumb — because there's no pipeline between what you know about your tool and what agents know about your tool. Docs are written for humans who browse. Types check individual API calls but can't encode intent. Training data is a snapshot of the ecosystem as it _was_, mixing versions without flagging which one applies. The knowledge gap between your tool and agents using your tool isn't a content problem. It's a lifecycle problem.

## Skills as side quests

The ecosystem is already moving toward agent-readable knowledge. Cursor rules, CLAUDE.md files, skills directories — the idea that agents need more than docs and types has landed. But the delivery mechanism hasn't caught up.

Right now, if you want your agent to understand TanStack Router, you go find a community-maintained rules file in some GitHub repo. Maybe it's in `awesome-cursorrules`. Maybe someone linked it in Discord. You copy it into your project's `.cursorrules` or `CLAUDE.md`. Then you do the same for TanStack Query. And TanStack Table. Each one sourced from a different place, written by a different person, at a different point in time.

Now multiply that across every tool in your stack. You're managing a pile of copy-pasted knowledge files with no versioning, no update mechanism, and no way to know when they've gone stale. Did TanStack Router ship a breaking change last week? Your rules file doesn't know. Is the Query skill you grabbed written for v4 or v5? Hope you checked.

Finding skills is manual. Installing them is manual. Keeping them current is manual. And when they drift — and they always drift — you don't find out until your agent starts producing subtly wrong code again.

Meanwhile, library maintainers already have the knowledge agents need. It lives in their docs, migration guides, "common mistakes" GitHub discussions, Discord answers. But none of it reaches agents through a channel the maintainer controls. The knowledge exists. What's missing is a delivery mechanism tied to the package itself — not scattered across the ecosystem.

![The status quo: scattered rules files from different repos, authors, and versions, all manually copy-pasted into one project](/blog-assets/from-docs-to-agents/diagram-status-quo.svg)

## Introducing `@tanstack/intent`

`@tanstack/intent` is the missing lifecycle layer. It's a toolkit for generating, discovering, and maintaining skills for your library — and shipping them as npm packages so they travel with your code.

```bash
pnpm add -D @tanstack/intent
```

The core idea: **intents are npm packages of skills.** They encode how tools work together, what patterns apply for which goals, and what to avoid. Skills travel with the tool via `npm update`, not the model's training cutoff. Not community-maintained rules files in separate repos. Not prompt snippets in READMEs. Versioned knowledge the maintainer owns, shipped through npm, updated when the package updates.

A skill is a focused projection of knowledge you already maintain — the critical constraint an agent must know, the anti-pattern flagged explicitly, the composition rule stated once and clearly. Each skill declares which docs it was derived from:

```
---
name: tanstack-router-search-params
description: Type-safe search param patterns for TanStack Router
triggers:
  - search params
  - query params
  - validateSearch
metadata:
  sources:
    - docs/framework/react/guide/search-params.md
---
```

That `metadata.sources` field is load-bearing. When those docs change, the CLI flags the skill for review. You're not maintaining two sources of truth — you're maintaining one, with a derived artifact that stays in sync.

## Generating and validating skills

You don't author skills from scratch. `intent scaffold` walks you through a guided workflow to generate skills for your library:

```bash
npx intent scaffold
```

The scaffold produces drafts you review, refine, and commit alongside your source code. Once you have skills, `intent validate` checks that your skill files are well-formed:

```bash
npx intent validate
```

And `intent setup` copies CI workflow templates into your repo so validation runs automatically on every push:

```bash
npx intent setup
```

This matters because the alternative is hoping model providers eventually re-train on your latest docs. That's not a strategy. Training data has a permanent version-mixing problem: once a breaking change ships, models contain _both_ versions forever with no mechanism to disambiguate. Skills bypass this entirely. They're versioned with your package, and `npm update` brings the latest knowledge with the latest code.

![Model training data mixes versions permanently vs. skills pinned to your installed version](/blog-assets/from-docs-to-agents/diagram-split-brain.svg)

## The dependency graph does the discovery

When a developer runs `intent init`, the CLI discovers every intent-enabled package in their project and wires the relevant skills into their agent configuration — CLAUDE.md, .cursorrules, whatever their tooling expects.

```bash
npx intent init
```

![intent init discovers intent-enabled packages in node_modules and wires skills into agent config](/blog-assets/from-docs-to-agents/diagram-discovery.svg)

No manual setup per-library. No hunting for rules files. Install the package, run `intent init`, and the agent understands the tool. Update the package, and the skills update with it. Knowledge travels through the same channel as code.

`intent list` shows you what's available:

```bash
npx intent list        # See what's intent-enabled in your deps
npx intent list --json # Machine-readable output
```

For library maintainers, `intent meta` surfaces meta-skills — higher-level guidance for how to author and maintain skills for your library:

```bash
npx intent meta
```

## From skills to playbooks

A single skill helps an agent use one tool correctly. But real development is composition — routing _with_ server state _with_ a data grid _with_ client-side storage. No individual skill covers how they fit together.

Playbooks are the orchestration layer. A developer says "build a paginated data table with URL-synced filters" and the playbook knows which skills to load and how they compose — the search params skill, the loader/query integration skill, the table columnDefs skill, in the right order. Developer goals map to skill combinations.

The more libraries in your stack that ship skills, the richer the composition story becomes.

## Keeping it current

The real risk with any derived artifact is staleness. You update your docs, ship a new API, and the skills silently drift. `@tanstack/intent` treats this as a first-class problem.

`intent stale` checks your skills for version drift — flagging any that may have fallen behind their source material:

```bash
npx intent stale           # Human-readable report
npx intent stale --json    # Machine-readable for CI
```

Run it in CI and you get a failing check when source material has changed. The skill becomes part of your release checklist — not something you remember to update, something your pipeline catches.

![The intent lifecycle: docs to skills to npm to agent config, with staleness checks and feedback loops](/blog-assets/from-docs-to-agents/diagram-lifecycle.svg)

The feedback loop runs both directions. `intent feedback` lets users submit structured reports when a skill produces incorrect output — which skill was active, which version, what went wrong. That context flows back to you as a maintainer, and the fix ships to everyone on the next `npm update`.

```bash
npx intent feedback
```

Skills that keep needing the same workaround are a signal. Sometimes the fix is a better skill. Sometimes it's a better API. A skill that dissolves because the tool absorbed its lesson is the system working as intended.

## Try it out

We've started rolling out skills in [TanStack DB](https://github.com/TanStack/db/pull/1330) with other TanStack libraries following. If you maintain a library, tell your coding agent to run `npx @tanstack/intent scaffold` and let us know how it goes. We're looking for feedback on the authoring workflow, the skill format, and what's missing. File issues on [GitHub](https://github.com/TanStack/intent) or find us on [Discord](https://tlinz.com/discord).

The lifecycle is: write your docs, generate skills, ship them with your package, validate and keep them current, learn from how they're used, make your tool better. Repeat.
