---
title: 'Intent 0.5: Skills You Can Maintain'
published: 2026-09-30
draft: false
excerpt: 'The maintainer release: check your examples, review source changes, and ship guidance with your library.'
library: intent
authors:
  - Sarah Gerrard
---

You rename an export, update the types, fix the tests, and ship a release. Somewhere in your package, a skill still tells an agent to use the old name.

Maybe the skill ships with the right version, but the instructions are wrong. This is where maintainers need to step in and correct the guidance, but how do you keep track of those corrections over time? It might just end up being forgotten or overlooked, adding to the technical debt rather than reducing it.

As a library maintainer, the last thing you want is to add more to maintain on top of everything your library already has. Writing guidance takes work, attention, and time, but keeping it useful means returning to it as the library changes which, in most cases, happens quite frequently. Which examples broke? Which explanations need a second look? Did any instructions become outdated or any new anti-patterns emerge? Did a new feature ship without any guidance at all?

Intent v0.5 adds checks for skill examples and a review workflow for source changes. It helps maintainers see what skills need attention as the library continues to evolve over time.

## Skills belong in the development process

If you're new to Intent, the idea is straightforward: library maintainers can ship agent skills inside their npm packages. When the package is installed, the skills come along with it, keeping the guidance packaged with the version of the library it describes. Those skills explain how to use the library, which patterns to follow, and what to avoid. It keeps the guidance close to the code it documents, ensuring it remains relevant and up-to-date, and reducing the chances of your agents following outdated or incorrect instructions.

Rather than being scattered, forgotten, or needing to scrape together a set of instructions on your own from various sources, these skills are packaged and maintained alongside the code with the sign-off from the maintainers themselves.

This helps to solve the delivery problem. It doesn't, by itself, solve the maintenance problem.

With 0.5, the new `intent maintainer` workflow brings authoring, validation, and source review into the repository. You might want to tackle it all at once, or you can approach it incrementally, focusing on the most critical tasks first and expanding as needed.

With that being said, it all starts with setting up the maintainer workflow in your repository.

```bash
npx @tanstack/intent@0.5.0 maintainer setup
```

When you run the setup command, it prepares your repository for maintaining skills by registering existing skills, adding the maintainer skills, and setting up the CI workflow. If you happen to have existing skills, they will be registered without modifying their contents. From there, your coding agent can help author skills, while Intent tracks their relationship to the package and its source.

For me, this is where tooling becomes useful: it reduces the effort required to keep track of what needs attention.

## Your examples can fail before someone uses them

An example in a skill is still code. It should be possible to check it like code.

With v0.5, `intent validate` checks fenced JavaScript and TypeScript examples in `SKILL.md`, including JSX and TSX. It also checks JavaScript libraries, using types inferred from source or declared through JSDoc.

```bash
npx @tanstack/intent@0.5.0 validate
```

Intent uses the TypeScript compiler to check these examples without running them. It reports missing exports, invalid options, type mismatches, and syntax errors with the skill file and line number. Deprecated imports produce warnings.

You don't have to turn every short example into a complete application. Partial snippets can leave out surrounding names and setup.

These checks require TypeScript 5.0 or newer. If TypeScript is unavailable or Intent cannot find the owning library's entry point, it reports that type checking was skipped.

Passing validation doesn't guarantee correct runtime behaviour or that an example teaches the best approach. It gives maintainers a way to catch API mistakes before those examples become instructions for someone else's agent.

## See what changed. Record what you decided.

A source change doesn't always mean a skill needs rewriting. Sometimes an implementation changes while the guidance remains correct. Other times, a small API change makes an entire example misleading.

`intent maintainer review` helps you work through that distinction. It identifies guidance affected by source changes and lists changes that have no mapped guidance. You can inspect the changes, then record whether you updated the skill or why it remains correct.

Those outcomes are tied to the reviewed source and skill contents. An unchanged review doesn't need to keep asking for the same decision, and an old decision isn't treated as approval of newly changed content.

That's a more useful question than “is this file old?” It's “has someone checked this guidance against what changed?”

## CI can help without deciding for you

The maintainer workflow includes reusable GitHub checks for validation, generated-file drift, and pending source reviews. Problems appear in the Actions summary, so reviewers can see what still needs attention.

There's also a new `intent repair` command for routine maintenance. It can apply unambiguous frontmatter fixes with `--write`, or produce a patch with `--patch` while conflicting metadata is left alone. Suggested code-example changes require review; write mode doesn't apply them.

The workflow can prepare repair patches even when validation fails. It won't publish fixes or mark a source review complete on your behalf, though.

The aim is to spend less time on mechanical corrections without hiding the decisions that still need a maintainer.

## Less waiting, too

This release also reduces CLI startup and discovery work. Runtime libraries are now bundled, so Intent installs as one package with no separate runtime dependencies.

Agent hooks use the locally installed CLI when one is available instead of resolving a package through the registry at every session start. If you already use hooks, reinstall them with `intent hooks install` to get the updated runner.

## Try it with a skill you already have

You don't need a complete skill library to use this release. Start with an existing skill, run setup, and validate its examples. On the next source change, use the review workflow to see what needs attention.

If you're moving from an earlier version, `intent scaffold` has been replaced by the maintainer workflow. `maintainer adopt` has also been removed; `maintainer setup` now handles registering existing skills.

Maintainers already hold a lot of knowledge about how their libraries should be used. Skills give that knowledge a way to reach coding agents. Intent 0.5 makes the ongoing work of checking and maintaining it more practical.

[Read the full Intent 0.5 release notes](https://github.com/TanStack/intent/releases/tag/%40tanstack/intent%400.5.0).
