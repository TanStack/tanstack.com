# Agent Guidelines

TanStack.com marketing site built with TanStack Start.

## Core principles for every task

Before writing code, walk this ladder. Stop at the first answer that works.

1. **Does this need to exist?** → no: skip it (YAGNI)
2. **Already in this codebase?** → reuse it, don't rewrite
3. **Stdlib does it?** → use it
4. **Native platform feature?** → use it
5. **Installed dependency?** → use it
6. **One line?** → one line
7. **Only then:** the minimum that works

Inspired by https://github.com/DietrichGebert/ponytail

### Abstraction & repetition

- **KISS** — keep it simple, stupid. Boring code beats clever code.
- **WET > DRY** — write everything twice (or more) before abstracting. Three similar usages with diverging needs is the cue to extract; two is not.
- Premature DRY couples unrelated code through a shared abstraction that ends up fighting both callers. Duplication is cheaper than the wrong abstraction.

### What this means in practice

- Don't add error handling, fallbacks, or validation for cases that can't happen.
- Don't introduce helpers, wrappers, or config knobs "for later."
- Don't refactor surrounding code while fixing a bug.
- When tempted to abstract: count the call sites and check they actually want the same behavior. If not, leave the duplication.

## Essentials

- Package manager: `pnpm`
- Run `pnpm test` before commits not after every tiny edit
- Don't run builds or tests after every change. This is a visual site; assume changes work unless reported otherwise.
- Rely on `tsc` or your built-in LSP integration (hopefully you have this)
- **Typesafety is paramount.** Never cast types; fix at source instead. See [typescript.md](./typescript.md).

## Topic Guides

- [TypeScript Conventions](./typescript.md): Type inference, casting rules, generic naming
- [TanStack Patterns](./tanstack-patterns.md): Loaders, server functions, environment shaking
- [UI Style Guide](./ui-style.md): Visual design principles for 2026
- [Workflow](./workflow.md): Build commands, debugging, Playwright
- [Analytics](./analytics.md): GA4 event taxonomy, funnel definition, custom dimensions
