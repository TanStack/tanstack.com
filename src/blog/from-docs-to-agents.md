---
title: "From Docs to Agents: Shipping Knowledge That Travels With Your Package"
published: 2026-03-04
authors:
  - Sarah Gerrard
  - Kyle Mathews
---

Your docs are good. Your types are solid. Your agent still gets it wrong.

Not because it's dumb — because nothing connects what you know about your tool to what agents know. Docs target humans who browse. Types check individual API calls but can't encode intent. Training data snapshots the ecosystem as it *was*, mixing versions without flagging which applies. The gap isn't content. It's lifecycle.

## Skills as side quests

The ecosystem already moves toward agent-readable knowledge. Cursor rules, CLAUDE.md files, skills directories — everyone agrees agents need more than docs and types. But delivery hasn't caught up.

Right now, if you want your agent to understand TanStack Router, you hunt for a community-maintained rules file in some GitHub repo. Maybe it's in `awesome-cursorrules`. Maybe someone linked it in Discord. You copy it into `.cursorrules` or `CLAUDE.md`. Then you repeat for TanStack Query. And TanStack Table. Each from a different place, a different author, a different point in time.

Multiply that across every tool in your stack. You're managing copy-pasted knowledge files with no versioning, no update path, and no staleness signal. Did TanStack Router ship a breaking change last week? Your rules file doesn't know. Is the Query skill you grabbed written for v4 or v5? Hope you checked.

Finding skills is manual. Installing them is manual. Keeping them current is manual. When they drift — and they always drift — you discover it only when your agent starts producing subtly wrong code.

Library maintainers already have the knowledge agents need — in docs, migration guides, "common mistakes" GitHub discussions, Discord answers. But none of it reaches agents through a channel the maintainer controls. The knowledge exists. The delivery mechanism doesn't.

![The status quo: scattered rules files from different repos, authors, and versions, all manually copy-pasted into one project](/blog-assets/from-docs-to-agents/diagram-status-quo.svg)

## Introducing `@tanstack/intent`

`@tanstack/intent` is the missing lifecycle layer — a toolkit for generating, discovering, and maintaining skills, shipped as npm packages that travel with your code.

```bash
pnpm add -D @tanstack/intent
```

The core idea: **intents are npm packages of skills.** They encode how tools compose, which patterns fit which goals, and what to avoid. Skills travel with the tool via `npm update` — not the model's training cutoff, not community-maintained rules files, not prompt snippets in READMEs. Versioned knowledge the maintainer owns, updated when the package updates.

A skill is a focused projection of knowledge you already maintain: the critical constraint, the flagged anti-pattern, the composition rule stated once and clearly. Each declares its source docs:

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

That `metadata.sources` field is load-bearing. When those docs change, the CLI flags the skill for review. One source of truth, one derived artifact that stays in sync.

## Generating and validating skills

You don't author skills from scratch. `intent scaffold` generates them from your library:

```bash
npx intent scaffold
```

The scaffold produces drafts you review, refine, and commit. Once committed, `intent validate` checks that they're well-formed:

```bash
npx intent validate
```

`intent setup` copies CI workflow templates into your repo so validation runs on every push:

```bash
npx intent setup
```

The alternative — hoping model providers re-train on your latest docs — is not a strategy. Training data has a permanent version-mixing problem: once a breaking change ships, models contain *both* versions forever with no way to disambiguate. Skills bypass this. They're versioned with your package, and `npm update` brings the latest knowledge with the latest code.

![Model training data mixes versions permanently vs. skills pinned to your installed version](./diagram-split-brain.svg)

## The dependency graph does the discovery

When a developer runs `intent install`, the CLI discovers every intent-enabled package and wires skills into the agent configuration — CLAUDE.md, .cursorrules, whatever the tooling expects.

```bash
npx intent install
```

![intent install discovers intent-enabled packages in node_modules and wires skills into agent config](./diagram-discovery.svg)

No per-library setup. No hunting for rules files. Install the package, run `intent install`, and the agent understands the tool. Update the package, and skills update too. Knowledge travels the same channel as code.

`intent list` shows you what's available:

```bash
npx intent list        # See what's intent-enabled in your deps
npx intent list --json # Machine-readable output
```

For library maintainers, `intent meta` surfaces meta-skills — higher-level guidance on authoring and maintaining skills:

```bash
npx intent meta
```

## From skills to intents

A single skill helps an agent use one tool correctly. Real development demands composition — routing *with* server state *with* a data grid *with* client-side storage. No single skill covers how they fit together.

Intents orchestrate. A developer says "build a paginated data table with URL-synced filters" and the intent loads the right skills in the right order — search params, loader/query integration, table columnDefs. Goals map to skill combinations.

The more libraries that ship skills, the richer composition becomes.

## Keeping it current

The real risk with any derived artifact is staleness. You update your docs, ship a new API, and skills silently drift. `@tanstack/intent` treats staleness as a first-class problem.

`intent stale` checks for version drift, flagging skills that have fallen behind their sources:

```bash
npx intent stale           # Human-readable report
npx intent stale --json    # Machine-readable for CI
```

Run it in CI and you get a failing check when sources change. Skills become part of your release checklist — not something you remember to update, but something your pipeline catches.

![The intent lifecycle: docs to skills to npm to agent config, with staleness checks and feedback loops](./diagram-lifecycle.svg)

The feedback loop runs both directions. `intent feedback` lets users submit structured reports when a skill produces wrong output — which skill, which version, what broke. That context flows back to you, and the fix ships to everyone on the next `npm update`.

```bash
npx intent feedback
```

Skills that keep needing the same workaround signal a deeper problem. Sometimes the fix is a better skill. Sometimes it's a better API. A skill that dissolves because the tool absorbed its lesson is the system working.

## The new job

Devtool makers have a new surface to maintain. You shipped code, docs, and types. Now there's a fourth artifact: skills — knowledge encoded for the thing writing most of your code.

Tools that invest here produce developers who build confidently from day one — not through tutorials or toy projects, but through correct patterns absorbed in real work.

The lifecycle is: write your docs, generate skills, ship them with your package, validate and keep them current, learn from how they're used, make your tool better. Repeat.