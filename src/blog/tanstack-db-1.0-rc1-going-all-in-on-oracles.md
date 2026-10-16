---
title: 'TanStack DB 1.0 RC1: Going All In on Oracles'
published: 2026-10-16
draft: true
excerpt: 'TanStack DB 1.0 RC1 is here. How oracles helped me find whole classes of bugs and rethink programming with agents.'
library: db
authors:
  - Kyle Mathews
---

_Agents make the models practical to write. The models help us find and fix whole classes of bugs._

I'm delighted to announce on behalf of the core DB maintainers, myself, Sam Willis, Kevin De Porre, and the entire DB community, that TanStack DB 1.0 RC1 is here!

After 1.5 years of development and betas and many discussions with users, the API is powerful and stable. We expect to ship 1.0 in a few short weeks.

Since our [0.6 release](https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes), we have shipped [server rendering and deep integration with TanStack Start](https://tanstack.com/db/latest/docs/guides/ssr), worked through a long run of correctness problems, and [made DB much faster for applications with many simultaneous live queries](https://github.com/TanStack/db/pull/1987).

This post covers what shipped for RC1 and what happened when I tried to fix every known DB bug. Oracles turned that apparently finite task into a search for whole classes of failures, changing how I think about programming and the frameworks, infrastructure, and developer tools agents build on.

If you haven't used it yet, TanStack DB is a reactive client data framework that makes backend data feel local. Records from your API or sync engine become typed collections. Components query them for joined, filtered live results. Optimistic edits appear immediately and reconcile with the server later.

Perhaps the biggest difference from earlier client-side databases is that you can adopt TanStack DB incrementally. Historically, getting reactive queries, optimistic mutations, and offline support often meant adopting a new database and sync architecture. With TanStack DB, you can start with your existing REST APIs and [TanStack Query](https://tanstack.com/query/latest) setup, immediately gain fast incremental relational queries, and progressively add [local persistence](https://tanstack.com/db/latest/docs/guides/sqlite-persistence), [durable offline mutations](https://tanstack.com/db/latest/docs/guides/offline-transactions), or real-time sync as your needs evolve. Because the application-facing query model stays the same, you can go from a conventional web application to a fully offline-capable, local-first app without rewriting everything along the way.

We began building DB in early 2025 at [ElectricSQL](https://electric-sql.com/), which incubated the project for its first year and a half. We [shipped the first beta that July](https://tanstack.com/blog/tanstack-db-0.1-the-embedded-client-database-for-tanstack-query). Since [Neon acquired us in August](https://neon.com/blog/electrifying-neon-building-the-realtime-backend), it has continued to back DB and we released yesterday [Neon Realtime](https://neon.com/docs/realtime/overview) with [TanStack DB support](https://neon.com/docs/realtime/sdks/typescript#tanstack-db).

Adoption is accelerating, with teams using TanStack DB to build everything from developer tools to consumer mobile apps. Prisma uses DB in [Prisma Studio](https://github.com/prisma/studio), its open-source database editor. Unkey uses it extensively across its [developer dashboard](https://github.com/unkeyed/unkey/tree/main/web/apps/dashboard), and Skylight uses DB and its offline capabilities in its [React Native family calendar app](https://www.youtube.com/watch?v=HSUKoa4JoRw).

Across its packages, DB now has [almost 3 million weekly NPM downloads](https://tanstack.com/db/latest). Compared to [weekly downloads of React](https://tanstack.com/stats/npm?packageGroups=%5B%7B%22packages%22%3A%5B%7B%22name%22%3A%22%40tanstack%2Fdb%22%7D%5D%7D%2C%7B%22packages%22%3A%5B%7B%22name%22%3A%22react%22%2C%22hidden%22%3Atrue%7D%5D%2C%22color%22%3A%22%2361DAFB%22%2C%22baseline%22%3Atrue%2C%22baselineLabel%22%3A%22React%22%7D%5D&range=1825-days&transform=none&binType=weekly&viewMode=history&chartType=line&barSort=value&bucketOffset=0&playbackIntervalMs=350&playbackLoop=false&playbackPlaying=false&showDataMode=all&normalizeBaseline=true&showBaseline=false&showLegend=false&height=400), downloads of the core DB package have grown roughly tenfold over the past year, to about 0.7% of React's downloads.

After server rendering landed a few months ago, I thought the remaining work before 1.0 was fairly straightforward: fix every known bug. I'd fire up my agents and set them loose and be done in a few weeks. Before and during that work, though, I tried some new ideas for making the coding environment more productive for agent swarms. The new environment has proved astonishingly effective at finding new bugs and undefined behavior. My short bug-fixing expedition has now stretched to hundreds of PRs and months of intense work hardening DB's core abstractions for 1.0. Since the first PR in this push, the repository has gained roughly 330,000 lines of tests.

I've worked on open-source libraries for a long time and previously found it hard to find bugs proactively before users provide reproductions. Now essentially every new agent session stumbles on multiple new classes of bugs. After months of fixes, many of these bugs are now so obscure that I suspect no one has encountered them in the wild. Yet they keep coming. Increasingly, my job is to keep agents from fixing _too much_—chasing hypothetical edge cases or adding complexity to solve problems DB never promised to solve.

## Crafting a playable environment for agents

The basic problem coding agents present is: when implementation gets cheap, what is left for programmers to do? My answer is _crafting a playable environment for agents_. Programmers shape the _design space_ for swarms of agents: what they can see, which moves they can make, how to judge the results, and what each round passes to the next.

Over the past few months, I've made the DB repository _playable_ for fresh agent sessions. An agent can find what a part of DB promises, try a small change or challenge that promise, and see the consequences quickly. I can run many short investigations in parallel. What one session discovers becomes the starting point for the next.

I use one recurring loop: start with a report or design question, ask what general behavior ought to hold, search for counterexamples, then revise the implementation, the rule, or how we verify it. I decide the product promise when it isn't settled. Agents do much of the searching. A bug fix improves DB; a clearer rule or stronger verification improves what later agents can discover.

Oracles have become the most powerful form of verification in that loop. **Each oracle judges one small part of DB against an independently stated law about what users should observe.** Many use a small reference model to predict what should happen across legal sequences of operations, then compare that prediction with production's public behavior. A unit test can keep one reported failure from returning. An oracle keeps asking whether the rule behind that failure holds across other cases. DB now has **161 oracle test files across 14 packages**, covering [collection change messages](https://github.com/TanStack/db/blob/main/packages/db/tests/change-event-history-oracle.test.ts), [nested live-query includes](https://github.com/TanStack/db/blob/main/packages/db/tests/query/includes-cross-formulation-oracle.property.test.ts), and [cursor pagination](https://github.com/TanStack/db/blob/main/packages/query-db-collection/tests/cursor-pagination.oracle.test.ts), among other behaviors. Sometimes an agent finds that an oracle missed a bug. Strengthening that judge gives later investigations a better instrument.

I've written and heavily iterated on [oracle-authoring](https://github.com/TanStack/db/blob/main/.agents/skills/oracle-authoring/SKILL.md) and [oracle-review](https://github.com/TanStack/db/blob/main/.agents/skills/oracle-review/SKILL.md) SKILLs, plus a rigorous [14-part rubric](https://github.com/TanStack/db/blob/main/docs/contributing/oracle-rubric.md) that agents use to evaluate and improve their oracles.

## The bug list kept growing

No software survives contact with reality. Software becomes battle-tested when many people use it in different ways and maintainers fix what those uses reveal. That maturation normally takes years.

We made things harder for ourselves with DB's ambitious and radically simple APIs. As our [0.5 post](https://tanstack.com/blog/tanstack-db-0.5-query-driven-sync) put it: “You describe what data you need. DB handles the fetching, caching, and updating.” A single query shapes what DB asks the backend to load across thousands of potential loading scenarios. Our promise that client queries drive data loading and sync has to hold across on-demand queries, pagination, [persistence and offline use](https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes), optimistic edits, retries, and reconnection. Consider an issue board showing the ten highest-priority open issues. Complete one, and the replacement may be the eleventh issue, which the client has never loaded. Add pages and offline restarts, and the possible interactions multiply. Some failures are ordinary bugs. Others reveal undefined behavior or push data-loading complexity back into application code.

When I started tackling our seemingly finite bug list, I surveyed open issues and PRs, grouped related reports, and asked agents what work would solve each entire cluster. One result was the [framework-adapter RFC](https://github.com/TanStack/db/issues/1623) and a [conformance suite](https://github.com/TanStack/db/pull/1636) to make the same public behavior hold across framework adapters. An agent working through another cluster suggested oracle tests. They spread through the RFC work and across DB because each investigation exposed nearby questions the original report hadn't asked. I've merged 350 bug-fixing PRs since starting this work.

One sequence of fixes makes this loop concrete. A user report led to an oracle, which agents then tried to break. Each blind spot led to a stronger oracle that exposed bugs the previous version couldn't see. The implementation improved, but so did the instrument for investigating it.

A user [reported a bug](https://github.com/TanStack/db/issues/1901) with collection change messages. They deleted a row and reinserted a replacement with the same key in one turn. A direct read returned the replacement, but a subscriber replaying the messages could end with no row at all. An application maintaining a cache from those messages could silently lose data.

[PR #1902](https://github.com/TanStack/db/pull/1902) fixed the immediate failure and added an oracle for the broader promise: **a subscriber applying every change message should end up with the same rows as a direct read.** Its reference model is a plain map of keyed rows. It generates legal sequences of inserts, updates, and deletes, runs them both one at a time and batched together, and compares three results: what the map predicts, what DB returns from a direct read, and what a subscriber reconstructs from DB's messages. That checks the reported delete-and-reinsert sequence alongside nearby sequences involving other starting rows, keys, and operation orders. A future change has to preserve the agreement across all of them.

Then an agent tried removing branches from the collection code to see which ones the tests actually needed. One removal passed the oracle and produced a better change message than the original branch. The oracle had a blind spot: its simulated subscriber used the same map operation for an **insert** and an **update**. It could reconstruct the right final rows even when DB sent an update for a row the subscriber had already deleted. A real subscriber that applies updates only to existing rows would reject it or lose the row.

I strengthened the rule the subscriber checks as it replays each message: **insert requires an absent key; update and delete require a present key.** The old code then failed 26 of 378 histories already reaching that path. [PR #1995](https://github.com/TanStack/db/pull/1995) made DB send an insert when the key became visible again. The same generated histories now check both the final rows _and_ whether every message was valid at the moment a subscriber received it. The original oracle could catch a missing row; the stronger one can catch a broken message even when the final rows happen to match.

A review exposed another gap. While reviewing [PR #2004](https://github.com/TanStack/db/pull/2004), CodeRabbit found that replacing the server's source rows during an optimistic edit could send **two inserts for the same key**. The existing subscriber setup filtered out the second insert before the oracle saw it. For [PR #2005](https://github.com/TanStack/db/pull/2005), an agent added a subscriber seeded with the current visible rows that received the raw change messages. After every batch, it checks whether each message is valid for the rows that subscriber actually holds, then compares the subscriber's reconstructed rows with the independent model. The old code failed seven cases. The fix published each key once, and the stronger oracle went on to find another invalid insert when a pending delete crossed an optimistic insert. The new observation point made an entire path of previously hidden failures visible.

The original report was fixed in #1902. The stronger oracle still found invalid updates and duplicate inserts. Fixing the reported sequence became the start of an investigation into the broader contract.

Other investigations require me to decide the promise before an oracle can enforce it. During a code simplification audit, an agent found a case where an ordered query's row changed value A → B → A while notifications were held, but also moved behind another row. DB sent no callback when it released the result. A subscribed component could keep showing the old order. I chose the last result subscribers **actually saw** as the comparison point: the private value excursion needs no update, but the public move needs a notification. The oracle for [PR #1933](https://github.com/TanStack/db/pull/1933) runs that held sequence through a real ordered query, checks that nothing is published during the hold, and compares the final rows and callbacks with a small model that sorts the source rows. Neighboring cases distinguish a pure move from a lasting value change. The old implementation missed the final callback; the repaired one passes those checks.

This is how I pursue a whole class of bugs. I turn the report into a law, generate related histories, and check the public behavior at the point where a user or subscriber would notice the difference. I also test the instrument against the old implementation or a plausible wrong change. When another path reveals a blind spot, I expand what the oracle drives or observes. That stronger instrument stays in the repository for the next agent.

## Look for cranes

I've been reading Daniel Dennett's [_Darwin's Dangerous Idea_](https://www.simonandschuster.com/books/Darwins-Dangerous-Idea/Daniel-C-Dennett/9780684824710). Darwin's startling claim, in Dennett's account, was that natural selection, with no foresight, could produce eyes, brains, and other astonishingly intricate adaptations. Many people doubted that a blind process could do this and looked for an outside intelligence to supply the design. Dennett calls that explanatory move a **skyhook**: it lifts the finished complexity into place from above, like the _deus ex machina_ of Greek theater, where stage machinery lowers a god to resolve a plot. To explain how complexity actually develops, we need mechanisms that work within the process.

Dennett calls these evolutionary mechanisms **cranes**—construction cranes. Both skyhooks and cranes lift; the difference is that a crane stands on the ground and works from what is already there. In evolution, a crane makes more possibilities reachable for the next round of variation and selection. Sexual reproduction, for example, shuffles inherited variants into new combinations, opening paths that mutation in a single lineage would reach much more slowly. A new crane often builds on older cranes. The path to complexity runs through accumulating mechanisms to speedily explore and test the design space.

The skyhook story in agentic programming is that a sufficiently intelligent model, given a repository, will infer every unstated rule and deliver the right system in one leap. One-shot coding makes that easy to believe for familiar tasks, but those successes stand on compilers, types, libraries, conventions, examples, tests, and a vast history of solved problems in the model's training. Every substantial software project runs into questions that history hasn't settled. Features interact in unexpected ways; new uses reveal missing guarantees; performance work opens up alternative implementations. There is no finished answer for an agent to retrieve. The work is to search the design space, decide what should hold, and test candidate answers. Agents need cranes that make that search productive and preserve what each investigation learns.

For agents working on DB itself, an oracle is a crane because it turns a reported failure into a repeatable search over a law. [Fast-check](https://fast-check.dev/) generates legal sequences of operations and shrinks a failure into a short counterexample. An agent can run proposed fixes and simpler implementations through the same instrument and see where their behavior diverges. The oracle makes many neighboring cases cheap to explore and bad candidates easy to reject.

I've set up the repository so a fresh agent can use these instruments without reconstructing months of design decisions. [Project guidelines](https://github.com/TanStack/db/blob/main/AGENTS.md) point it to the glossary, architecture documents, and [coverage map](https://github.com/TanStack/db/blob/main/docs/contributing/oracle-coverage.md), which identifies the oracle responsible for each behavior and its limits. The oracle files put the law beside the small model, generated histories, production path, and comparison, so an agent can read the promise and run an experiment in the same place. The [authoring](https://github.com/TanStack/db/blob/main/.agents/skills/oracle-authoring/SKILL.md) and [review](https://github.com/TanStack/db/blob/main/.agents/skills/oracle-review/SKILL.md) guides teach agents to strengthen that experiment; hostile reviewers follow the same paths to find plausible wrong implementations. A new session starts with a map of the system, runnable experiments, and ways to challenge the experiments themselves.

Framework conformance tests and benchmarks add feedback for shared behavior and speed. I've also used [TLA+](https://lamport.org/tla/tla.html) to explore the possible sequences of a proposed [query-scoped subscription design](https://github.com/TanStack/db/issues/1935).

I shape the _fitness landscape_ generally by editing the [AGENTS.md](https://github.com/TanStack/db/blob/main/AGENTS.md). For example I say "all PRs must be net negative for production code". This pushes agents hard to avoid bloated and duplicative implementations.

That extensive machinery I've developed matters because DB's API opened a huge design space. On-demand queries, pagination, persistence, optimistic writes, and synchronization meet in combinations we never enumerated when designing it. Together, these instruments help us build a richer theory of how clients should load, update, reconcile, and present data.

Paradoxically, the bug list keeps growing because our ability to find bugs keeps improving. Three months and many billions of tokens have produced more than a pile of fixes: agents now investigate DB with instruments that get sharper as they use them. That change in their working environment has mattered far more than any model upgrade I've seen.

## Superhistory

An afternoon can compress what used to be weeks of software history. Venkatesh Rao calls this agent-mediated compression of experience [“artificial time”](https://contraptions.venkateshrao.com/p/superhistory-not-superintelligence). This release push feels like a software-development version of his “superhistory.” I spend much of the day in what feels like a succession of intense design meetings, with fresh evidence arriving 100x faster than I could have gathered it myself.

Building software starts as an act of invention, but much of its maturation is discovery. DB's API created a world with rules whose consequences we didn't fully know. As users try it and agents probe its combinations, unexpected interactions reveal ambiguities, missing guarantees, and layers of architecture we hadn't anticipated. Some consequences follow from existing promises; others call for new rules.

That's what superhistory feels like from inside: questions that normally accumulate across years are arriving in months. Implementation work clears quickly, leaving me in a steady stream of design decisions. I spend much more of my day deciding what DB should guarantee and whether a fix simplifies the system or adds unnecessary machinery. Programming has become more intellectually demanding for me even as writing the code has become cheaper.

Artificial time changes the economics of rigor. An oracle needs a model, generated histories, a production driver, and continuing review as the system changes. Since this push began, DB has gained roughly 330,000 lines of tests—probably more code than I wrote in my entire life before AI. Agents make that work practical.

## The world DB creates for your agents

Good programming abstractions create smaller, more consistent worlds for the code above them. A filesystem gives programs files and paths instead of disk sectors. TCP gives them an ordered stream even when the network drops or reorders packets. A programming language gives them functions and types instead of registers and jump instructions. Each settles a mass of lower-level questions so the next layer can make more ambitious moves.

DB creates a simpler world of client data for application developers and their agents. An agent building an application can work with typed collections backed by TanStack Query over an existing API, a sync engine, or local persistence. It can join issues with projects, show one team's open work, and edit optimistically without building a separate endpoint and cache path for every screen. DB keeps the live results current while handling on-demand fetching, pagination, and reconciliation with the server.

For that world to exist, DB must deliver on its guarantees. A joined, filtered view stays current as its underlying records change. An optimistic edit appears immediately, then remains when persistence succeeds or rolls back when it fails. With on-demand sync, the query can shape backend requests so a screen loads only the rows it needs. Those promises still have to hold when pagination, offline persistence, and server updates interact—and at the speed a demanding application needs. The last three months of work have been about making this simplified world reliable enough to build on.

When you start a new application, you can experiment more freely by building on DB's mature data mechanics. You and your agents can focus on behaviors you want to create instead of rebuilding query, cache, and sync behavior for each screen.

The oracles I've described live in DB's repository. They help me and other contributors strengthen DB; applications benefit from the guarantees they protect. DB's guarantees are an example of what frameworks, infrastructure, and developer tools offer: a detailed theory of how some part of software should work. Their APIs and runtime behavior already shape applications. Coding agents open another route for that knowledge: it can guide the code an agent writes. [SKILLs](https://agentskills.io/home) are a first step, explaining which abstractions to use, what the system guarantees, and where the application has a decision to make.

I'm exploring how to expose those guarantees directly to agents building applications, beyond written guidance. A framework could provide executable rules, diagnostics, and conformance tests that reach into application code. An agent building a custom sync adapter, for instance, could run it against DB's change-message rules and get a short failing history if it sends an update for a key the subscriber has never seen.

These are cranes for userland: mechanisms that work inside the application-building process, helping agents explore and construct the next layer on top of a framework. The next generation of frameworks, infrastructure, and developer tools will create rich, lawful, playable worlds for applications and equip coding agents to build within them.

Here's one idea we're exploring for where to take TanStack DB next: write ordinary server functions to query and mutate Postgres, and DB compiles them into the collections and actions your client uses.

```tsx
// Server: define a query
const todos = query({
  async handler(req, res) {
    return res.json(await db.select().from(todo))
  },
})

// Server: define a mutation
const addTodo = mutation({
  async handler(req, res) {
    return res.json(await db.insert(todo).values(req.body).returning())
  },
})

// Client: use the generated collection and action
const { data } = useLiveQuery(todos)
addTodo({ id: crypto.randomUUID(), text: 'Hello world' })
```

_Simplified sketch of an experimental API._

DB also generates the data-loading and mutation wiring. When a mutation runs, the client tells the server which query collections are live. The server determines which need updating and returns fresh results with the mutation response.

Making this work broadly means understanding enough of Postgres's vast language to preserve query meaning, determine which reads a write affects, and reconcile client state correctly. A few years ago, I wouldn't have considered attempting the larger project. The last three months have changed the economics: agents can explore that space, find where the design breaks, and carry stronger instruments into the next investigation. That makes an extraordinarily demanding abstraction tractable enough to pursue.

I began this push with a finite bug list. It became a continuing process of deciding what DB should promise, finding consequences of those decisions, and giving the next agent stronger equipment for the search. TanStack DB 1.0 RC1 is the result so far. [Try it](https://tanstack.com/db/latest/docs/quick-start) in a demanding application and tell us [what breaks](https://github.com/TanStack/db/issues) or [what DB makes needlessly hard to build](https://github.com/TanStack/db/discussions). Those reports are how the next layer of design begins.
