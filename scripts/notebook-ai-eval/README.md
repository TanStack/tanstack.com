# Notebook AI evals

These evals drive the real `/notebook/ai` UI, agent stream, repair loop, iframe, and WebContainer. The runner is generic. Library knowledge lives only in `cases.ts`.

Start the development server, then run one isolated attempt per case:

```bash
pnpm dev
pnpm eval:notebook-ai
```

The default connection is the local ChatGPT login used by the notebook spike. Connect it once through `/notebook/ai` before running.

Use BYOK instead:

```bash
OPENAI_API_KEY=... pnpm eval:notebook-ai -- --connection openai --model gpt-5.6-terra
ANTHROPIC_API_KEY=... pnpm eval:notebook-ai -- --connection anthropic --model claude-sonnet-4-6
```

Filter and repeat cases:

```bash
pnpm eval:notebook-ai -- --case charts-basic-bar --runs 3
pnpm eval:notebook-ai -- --case react-query-refetch --headed
```

The runner uses an installed Chrome through `playwright-core`. Set `NOTEBOOK_EVAL_BROWSER` to an executable path when Chrome is installed elsewhere.

Results, final executions, and failure screenshots are written under `.cache/notebook-ai/evals/`. Request bodies, API keys, HAR files, and Playwright traces are never stored.

The first matrix covers:

- TanStack Charts bar rendering and responsive geometry
- React Query loading, exact results, and refetch behavior
- TanStack Table v9 filtering, sorting, and accessible state
- TanStack Start client navigation, direct route reloads, and a server function

The Start case is expected to expose the current harness gap: it cannot yet create arbitrary files or select the Start runtime. Do not pre-seed the case to make it pass.
