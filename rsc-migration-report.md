# RSC Migration Report

Status: bundle + code audit complete. Production Lighthouse baseline and post-deploy compare captured.

## Scope

This report tracks the impact of moving markdown-heavy and code-heavy surfaces to React Server Components and server-rendered code highlighting.

Pages explicitly covered:

- `/blog/react-server-components`
- `/router/latest/docs/overview`
- `/router/latest/docs/framework/react/examples/basic`
- `/query/latest`
- `/router/latest`
- `/form/latest`
- `/table/latest`
- `/virtual/latest`

## Methodology

Bundle analysis:

- Baseline: clean `HEAD` worktree at `/tmp/tanstack-bundle-baseline`
- Current: this branch/worktree
- Metric: transitive built client JS graph per representative route from production build assets
- Unit: bytes and gzip bytes

Production baseline metrics:

- Captured against live `https://tanstack.com`
- Tool: Lighthouse via `npx lighthouse`
- Category: `performance`
- Strategy: default Lighthouse mobile simulation

Notes:

- Bundle numbers are the most trustworthy pre-ship metric here
- Lighthouse should be compared on the same production domain before and after deploy
- Production Lighthouse is noisy; treat single-run numbers as directional until we rerun after deploy

## Bundle Impact

Gzipped client JS, before vs after.

| Page                                                 |    Before |     After |      Delta |
| ---------------------------------------------------- | --------: | --------: | ---------: |
| `/blog/react-server-components`                      | 547,196 B | 394,207 B | -152,989 B |
| `/router/latest/docs/overview`                       | 563,295 B | 410,644 B | -152,651 B |
| `/router/latest/docs/framework/react/examples/basic` | 421,421 B | 381,079 B |  -40,342 B |
| `/table/latest`                                      | 451,744 B | 409,455 B |  -42,289 B |
| `/query/latest`                                      | 405,185 B | 412,671 B |   +7,486 B |
| `/router/latest`                                     | 403,281 B | 411,259 B |   +7,978 B |
| `/form/latest`                                       | 401,951 B | 409,389 B |   +7,438 B |
| `/virtual/latest`                                    | 401,535 B | 409,044 B |   +7,509 B |

### Bundle Takeaways

- Big wins on markdown-heavy pages:
  - blog: about `-153 KB gz`
  - docs page: about `-153 KB gz`
- Clear win on docs example page: about `-40 KB gz`
- Clear win on table landing: about `-42 KB gz`
- Slight regressions on most other landing pages: about `+7-8 KB gz`

Interpretation:

- The pages dominated by markdown parsing and client-side highlighting improved materially
- Most landing pages are now architecturally cleaner, but not smaller yet
- The likely reason for the small landing regressions is that the old landing code-example path had more lazy/client indirection, while the new server-rendered example shell is part of the initial experience

## Client Boundary Audit

Verified absent from current `dist/client/assets`:

- `shiki`
- `@shikijs/*`
- `createHighlighter`
- `codeToHtml`
- `html-react-parser`
- `remark-*`
- `rehype-*`
- `rehype-react`
- old client markdown renderer files
- old landing example card files
- representative raw example-source snippets

Implications:

- Markdown rendering pipeline is out of the client build
- Syntax highlighting pipeline is out of the client build
- Landing example source strings are out of the client build

Runtime spot checks also confirmed:

- docs/example pages no longer request Shiki/highlighting assets
- landing pages no longer hit the old client `CodeBlock` path

Nuance:

- Client sourcemaps still reference some server-fn stub names like `fetchRenderedCodeFile` and `fetchLandingCodeExample`
- Those are stubs, not the rendering/highlighting pipeline itself

## Code Simplicity

Git diff summary:

- `46 files changed`
- `1,017 insertions`
- `2,038 deletions`
- Net: about `-1,021` lines

Deleted legacy client-heavy files:

- `src/components/CodeExampleCard.tsx`
- `src/components/LazyCodeExampleCard.tsx`
- `src/components/SimpleMarkdown.tsx`
- `src/components/markdown/Markdown.tsx`
- `src/components/markdown/MarkdownFrameworkHandler.tsx`
- `src/components/markdown/MarkdownTabsHandler.tsx`
- `src/utils/markdown/processor.ts`

New server-focused structure:

- `src/components/markdown/renderCodeBlock.server.tsx`
- `src/components/markdown/CodeBlock.server.tsx`
- `src/utils/markdown/processor.rsc.tsx`
- `src/utils/markdown/renderRsc.tsx`
- `src/components/landing/codeExamples.server.tsx`
- `src/components/landing/LandingCodeExampleCard.server.tsx`

Dependency cleanup:

- Removed `html-react-parser`
- Removed `rehype-stringify`

Architectural simplifications:

- One server markdown pipeline instead of mixed client/server rendering
- One server code-highlighting pipeline instead of client Shiki
- One server landing-example registry instead of repeating large inline code maps across landing pages
- Example pages now use URL-driven server-rendered code panes instead of client raw source + client highlighting

## Current Production Lighthouse Baseline

Captured before shipping these changes.

| Page                            | Score |  FCP |  LCP | Speed Index |     TBT |   CLS | Interactive |     Bytes | Requests |
| ------------------------------- | ----: | ---: | ---: | ----------: | ------: | ----: | ----------: | --------: | -------: |
| `/query/latest`                 |    80 | 2.8s | 3.4s |        3.4s |   300ms | 0.001 |        6.1s |   765 KiB |       89 |
| `/blog/react-server-components` |    52 | 3.3s | 3.7s |        3.6s | 1,200ms |  0.15 |        7.8s | 1,101 KiB |       60 |
| `/router/latest/docs/overview`  |    78 | 3.0s | 3.6s |        3.9s |   280ms | 0.002 |        7.5s |   917 KiB |       81 |

Notes:

- These are single-run live production baselines, so expect some noise
- Blog is the most likely page to show strong post-deploy Lighthouse improvement because it had the largest client-bundle reduction
- Docs should also improve meaningfully
- Landing-page Lighthouse changes may be neutral or mixed except for table, based on current bundle data

## Post-Deploy Compare

| Page                            | Before Score | After Score | Before LCP | After LCP | Before TBT | After TBT | Before Bytes | After Bytes | Notes                                                                    |
| ------------------------------- | -----------: | ----------: | ---------: | --------: | ---------: | --------: | -----------: | ----------: | ------------------------------------------------------------------------ |
| `/query/latest`                 |           80 |          77 |       3.4s |      3.8s |      300ms |     250ms |      765 KiB |     784 KiB | Roughly flat. Slightly worse score/LCP on this run, slightly better TBT. |
| `/blog/react-server-components` |           52 |          74 |       3.7s |      3.6s |    1,200ms |     260ms |    1,101 KiB |     785 KiB | Clear win. Huge TBT and transfer-size drop, major score improvement.     |
| `/router/latest/docs/overview`  |           78 |          81 |       3.6s |      3.6s |      280ms |     200ms |      917 KiB |     777 KiB | Modest win. Better score, lower TBT, lower transfer size.                |

## Conclusions So Far

- Strong technical wins on markdown-heavy and code-heavy content pages
- Clear reduction in client responsibility and code complexity
- Clear removal of markdown parsing and syntax highlighting from the client bundle
- Not a universal bundle win across all landing pages yet
- Best pages to watch post-deploy: blog and docs

## Post-Deploy Read

- Blog got the clearest real-world benefit.
  - Lighthouse score improved from `52` to `74`
  - TBT dropped from `1,200ms` to `260ms`
  - transfer size dropped from `1,101 KiB` to `785 KiB`
- Docs improved, but less dramatically.
  - Lighthouse score improved from `78` to `81`
  - TBT dropped from `280ms` to `200ms`
  - transfer size dropped from `917 KiB` to `777 KiB`
- Query landing did not show a Lighthouse win on this run.
  - Score went from `80` to `77`
  - LCP worsened slightly from `3.4s` to `3.8s`
  - TBT improved slightly from `300ms` to `250ms`

Interpretation:

- The bundle-side story predicted this fairly well.
- The strongest wins landed on markdown-heavy pages where we removed the client markdown/highlighting pipeline.
- The landing-page story remains mixed because those pages were not dominated by markdown and some of the server-rendered example-shell work traded complexity reduction for slightly more initial shell work.
- If we want broader Lighthouse wins on library landings, the next work is probably not more RSC conversion. It is targeted landing-page performance work.
