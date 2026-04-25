# Agent Guidelines

TanStack.com marketing site built with TanStack Start.

## Essentials

- Package manager: `pnpm`
- Run `pnpm test` before commits or after significant code changes, not after every tiny edit
- Smoke tests live outside the default `pnpm test` path and are reserved for commit-hook validation
- Don't run builds after every change. This is a visual site; assume changes work unless reported otherwise.
- **Typesafety is paramount.** Never cast types; fix at source instead. See [typescript.md](.agents/typescript.md).

## Topic Guides

- [TypeScript Conventions](.agents/typescript.md): Type inference, casting rules, generic naming
- [TanStack Patterns](.agents/tanstack-patterns.md): Loaders, server functions, environment shaking
- [UI Style Guide](.agents/ui-style.md): Visual design principles for 2026
- [Workflow](.agents/workflow.md): Build commands, debugging, Playwright
