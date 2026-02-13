# Agent Guidelines

TanStack.com marketing site built with TanStack Start.

## Essentials

- Package manager: `pnpm`
- Run `pnpm test` at end of task batches (not after every tiny change)
- Don't run builds after every change. This is a visual site; assume changes work unless reported otherwise.
- **Typesafety is paramount.** Never cast types; fix at source instead. See [typescript.md](.claude/typescript.md).
- **No emdashes.** Use periods, commas, colons, or parentheses instead.

## Topic Guides

- [TypeScript Conventions](.claude/typescript.md): Type inference, casting rules, generic naming
- [TanStack Patterns](.claude/tanstack-patterns.md): Loaders, server functions, environment shaking
- [UI Style Guide](.claude/ui-style.md): Visual design principles for 2026
- [Workflow](.claude/workflow.md): Build commands, debugging, Playwright
