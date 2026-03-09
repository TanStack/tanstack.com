---
title: 'Introducing TanStack Intent: Ship Agent Skills with your npm Packages'
published: 2026-03-04
authors:
  - Sarah Gerrard
  - Kyle Mathews
---

![From Docs to Agents](/blog-assets/from-docs-to-agents/header.png)

Your docs are good. Your types are solid. Your agent still gets it wrong.

Not because it's dumb — because nothing connects what you know about your tool to what agents know. Docs target humans who browse. Types check individual API calls but can't encode intent. Training data snapshots the ecosystem as it _was_, mixing versions with no way to tell which applies. The gap isn't content. It's lifecycle.

## The copy-paste era

The ecosystem already moves toward agent-readable knowledge. Cursor rules, CLAUDE.md files, skills directories — everyone agrees agents need more than docs and types. But delivery hasn't caught up.

Today, if you want your agent to understand TanStack Router, you hunt for a community-maintained rules file on GitHub. Maybe it's in `awesome-cursorrules`. Maybe someone linked it in Discord. You copy it into `.cursorrules` or `CLAUDE.md`. Then you repeat for TanStack Query. And TanStack Table. Each from a different place, author, and point in time.

Multiply that across every tool in your stack. You're managing copy-pasted knowledge files with no versioning, no update path, and no staleness signal. Did TanStack Router ship a breaking change last week? Your rules file doesn't know. Is that Query skill written for v4 or v5? Hope you checked.

Finding skills is manual. Installing them is manual. Keeping them current is manual. When they drift — and they always drift — you discover it only when your agent produces subtly wrong code.

Library maintainers already have the knowledge agents need — in docs, migration guides, "common mistakes" GitHub discussions, Discord answers. But none of it reaches agents through a channel the maintainer controls. The knowledge exists. The delivery mechanism doesn't.

![The status quo: scattered rules files from different repos, authors, and versions, all manually copy-pasted into one project](/blog-assets/from-docs-to-agents/diagram-status-quo.svg)

## Introducing `@tanstack/intent`

`@tanstack/intent` is a CLI for library maintainers to generate, validate, and ship [Agent Skills](https://agentskills.io) alongside their npm packages. The [Agent Skills spec](https://agentskills.io) is an open standard already adopted by VS Code, GitHub Copilot, OpenAI Codex, Cursor, Claude Code, Goose, Amp, and others.

**Skills ship inside your npm package.** They encode how your tool works, which patterns fit which goals, and what to avoid. Skills travel with the tool via `npm update` — not the model's training cutoff, not community-maintained rules files, not prompt snippets in READMEs. Versioned knowledge the maintainer owns, updated when the package updates.

For popular, stable patterns — standard React hooks, Express middleware, Tailwind classes — agents do well. Training data is saturated with correct usage. But at the frontier — new tools, major version transitions, novel compositions across packages — agents hallucinate, confuse versions, and miss critical implications. The frontier is bigger than it sounds: every new library, every breaking change, every composition across tools that nobody has written about. And once a breaking change ships, models don't "catch up." They develop a permanent split-brain — training data contains _both_ versions forever with no way to disambiguate. Skills bypass this. They're pinned to the installed version.

![Model training data mixes versions permanently vs. skills pinned to your installed version](/blog-assets/from-docs-to-agents/diagram-split-brain.svg)

A skill is a short, versioned document that tells agents how to use a specific capability of your library — correct patterns, common mistakes, and when to apply them. Each skill declares which docs it was derived from:

```
---
name: tanstack-router-search-params
description: Type-safe search param patterns for TanStack Router. Use when working with search params, query params, or validateSearch.
metadata:
  sources:
    - docs/framework/react/guide/search-params.md
---
```

Inside the skill, you write what the agent needs to get right — including what NOT to do:

```markdown
## Search Params

Use `validateSearch` to define type-safe search params on a route:

const Route = createFileRoute('/products')({
validateSearch: z.object({
page: z.number().default(1),
filter: z.string().optional(),
}),
})

## Common Mistakes

❌ Don't access search params via `window.location` — use
`useSearch()` which is fully type-safe.

❌ Don't parse search params manually. `validateSearch` handles
parsing, validation, and defaults.
```

That `metadata.sources` field is what keeps skills current. When those docs change, the CLI flags the skill for review. One source of truth, one derived artifact that stays in sync.

## Generating and validating skills

You don't author skills from scratch. `@tanstack/intent scaffold` generates them from your library:

```bash
npx @tanstack/intent scaffold
```

The scaffold produces drafts you review, refine, and commit. Once committed, `@tanstack/intent validate` checks that they're well-formed:

```bash
npx @tanstack/intent validate
```

`@tanstack/intent setup-github-actions` copies CI workflow templates into your repo so validation runs on every push:

```bash
npx @tanstack/intent setup-github-actions
```

## The dependency graph does the discovery

That's the maintainer side. For developers, the experience is simpler.

When a developer runs `@tanstack/intent install`, the CLI discovers every intent-enabled package and wires skills into the agent configuration — CLAUDE.md, .cursorrules, whatever the tooling expects.

```bash
npx @tanstack/intent install
```

![intent install discovers intent-enabled packages in node_modules and wires skills into agent config](/blog-assets/from-docs-to-agents/diagram-discovery.svg)

No per-library setup. No hunting for rules files. Install the package, run `@tanstack/intent install`, and the agent understands the tool. Update the package, and skills update too. Knowledge travels the same channel as code.

`@tanstack/intent list` shows what's available:

```bash
npx @tanstack/intent list        # See what's intent-enabled in your deps
npx @tanstack/intent list --json # Machine-readable output
```

For library maintainers, `@tanstack/intent meta` surfaces meta-skills — higher-level guidance on authoring and maintaining skills:

```bash
npx @tanstack/intent meta
```

## Keeping it current

The real risk with any derived artifact is staleness. You update your docs, ship a new API, and skills silently drift. `@tanstack/intent` treats staleness as a first-class problem.

`@tanstack/intent stale` checks for version drift, flagging skills that have fallen behind their sources:

```bash
npx @tanstack/intent stale           # Human-readable report
npx @tanstack/intent stale --json    # Machine-readable for CI
```

Run it in CI and you get a failing check when sources change. Skills become part of your release checklist — not something you remember to update, but something your pipeline catches.

![The intent lifecycle: docs to skills to npm to agent config, with staleness checks and feedback loops](/blog-assets/from-docs-to-agents/diagram-lifecycle.svg)

The feedback loop runs both directions. `@tanstack/intent feedback` lets users submit structured reports when a skill produces wrong output — which skill, which version, what broke.

```bash
npx @tanstack/intent feedback
```

That context flows back to you as a maintainer, and the fix ships to everyone on the next `npm update`. Every support interaction produces an artifact that prevents the same class of problem for all future users — not just the one who reported it. This is what makes skills compound: each fix makes the skill better, and each `npm update` distributes the improvement.

Skills that keep needing the same workaround signal something deeper. Sometimes the fix is a better skill. Sometimes it's a better API — the tool should absorb the lesson directly. A skill that persists forever means the tool has a design gap. A skill that disappears because the tool fixed the underlying problem is the system working exactly as intended.

## Try it out

We've started rolling out skills in [TanStack DB](https://github.com/TanStack/db/pull/1330) with other TanStack libraries following. If you maintain a library, tell your coding agent to run `npx @tanstack/intent scaffold` and let us know how it goes. We want feedback on the authoring workflow, the skill format, and what's missing. File issues on [GitHub](https://github.com/TanStack/intent) or find us on [Discord](https://tlinz.com/discord).

The lifecycle: write your docs, generate skills, ship them with your package, validate and keep them current, learn from usage, improve your tool. Repeat.
