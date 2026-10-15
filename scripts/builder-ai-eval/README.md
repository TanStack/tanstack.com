# Builder AI evals

These evals drive the real `/builder/ai` UI, agent stream, repair loop, iframe, and WebContainer. The runner is generic. Library knowledge lives only in `cases.ts`.

Start the development server, then run one isolated attempt per case:

```bash
pnpm dev
pnpm eval:builder-ai
```

The default connection is the local ChatGPT login used by the builder spike. Connect it once through `/builder/ai` before running.

Use BYOK instead:

```bash
OPENAI_API_KEY=... pnpm eval:builder-ai -- --connection openai --model gpt-5.6-terra
ANTHROPIC_API_KEY=... pnpm eval:builder-ai -- --connection anthropic --model claude-sonnet-4-6
```

Filter and repeat cases:

```bash
pnpm eval:builder-ai -- --case charts-basic-bar --runs 3
pnpm eval:builder-ai -- --case react-query-refetch --headed
```

The runner uses an installed Chrome through `playwright-core`. Set `BUILDER_EVAL_BROWSER` to an executable path when Chrome is installed elsewhere.

Results, final executions, and failure screenshots are written under `.cache/builder-ai/evals/`. Request bodies, API keys, HAR files, and Playwright traces are never stored.

The first matrix covers:

- TanStack Charts bar rendering and responsive geometry
- React Query loading, exact results, and refetch behavior
- TanStack Table v9 filtering, sorting, and accessible state
- TanStack Start client navigation, direct route reloads, and a server function

The Start case is expected to expose the current harness gap: it cannot yet create arbitrary files or select the Start runtime. Do not pre-seed the case to make it pass.
