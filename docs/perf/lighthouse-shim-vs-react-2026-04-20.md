# Lighthouse: @tanstack/dom-vite shim vs. real React

**Date:** 2026-04-20
**tanstack.com commit at time of measurement:** `fb806bb` (shim build with `@tanstack/dom-vite@0.1.0-alpha.5`, pulling `@tanstack/react-dom@0.1.0-alpha.4` — includes the RSC deferred-hydration adoption fix landed the same day).
**React baseline build:** same source tree with `tanstackDom()` plugin removed from `vite.config.ts` and `serverVariantAliases` dropped — i.e. stock `react@19.2.3` / `react-dom@19.2.3`.

## TL;DR

- **Performance score: parity** (±2 across pages / form factors, within run-to-run noise).
- **FCP: consistent shim win** everywhere — ~4% on home, ~11–17% on docs / blog. Smaller main-thread parse cost lets first paint land sooner.
- **LCP: shim regresses on RSC-heavy pages, desktop** — the LCP element on docs / blog pages lives in the Flight-streamed subtree, and the shim's `use(pendingPromise)` + deferred-resume adds latency vs. React's battle-tested RSC client. Mobile is mostly parity (network-bound anyway).
- **TBT / CLS: effectively zero on both** after the same-day RSC hydration fix — no duplicate DOM, no layout shift from appending.
- **Bundle (raw JS): −4.7%** on tanstack.com (-980 KB of 21 MB total client JS). Modest because router / store / app code dominates; shim only replaces React's share.

## Methodology

1. `pnpm build` for each variant.
2. `PORT=4000 pnpm start:prod` to serve from `dist/server/server.js` on `http://localhost:4000`.
3. **5 trials × 3 URLs × 2 form factors = 30 Lighthouse runs per variant** using `npx lighthouse` v13 with `--only-categories=performance` and headless Chrome.
4. Mobile runs use Lighthouse's default emulation (slow 4G + 4× CPU slowdown). Desktop uses `--preset=desktop` (no throttling).
5. Medians reported below.

## Medians

### Performance score

| URL                                                 |  form   | React | Shim |   Δ |
| --------------------------------------------------- | :-----: | ----: | ---: | --: |
| `/`                                                 | desktop |    99 |   99 |   0 |
| `/`                                                 | mobile  |    87 |   88 |  +1 |
| `/query/latest/docs/framework/react/guides/queries` | desktop |    96 |   96 |   0 |
| `/query/latest/docs/framework/react/guides/queries` | mobile  |    64 |   66 |  +2 |
| `/blog/react-server-components`                     | desktop |    98 |   96 |  −2 |
| `/blog/react-server-components`                     | mobile  |    70 |   71 |  +1 |

### Web Vitals

| URL                             |  form   |     FCP (R → S)      |     LCP (R → S)      |    TBT (R → S)     | CLS (R → S) |  TTI (R → S)  |
| ------------------------------- | :-----: | :------------------: | :------------------: | :----------------: | :---------: | :-----------: |
| `/`                             | desktop | 0.61s → 0.59s (−4%)  | 0.84s → 0.91s (+8%)  |     0ms → 0ms      |    0 → 0    | 0.84s → 0.92s |
| `/`                             | mobile  |    2.34s → 2.31s     | 3.71s → 3.60s (−3%)  |    19ms → 20ms     |    0 → 0    | 5.54s → 5.55s |
| `/query/.../queries`            | desktop | 1.05s → 0.92s (−13%) | 1.05s → 1.24s (+18%) |     0ms → 0ms      |    0 → 0    | 1.05s → 1.24s |
| `/query/.../queries`            | mobile  | 4.66s → 4.13s (−11%) | 6.62s → 6.39s (−3%)  |    17ms → 19ms     |    0 → 0    | 8.36s → 8.41s |
| `/blog/react-server-components` | desktop | 0.90s → 0.74s (−17%) | 0.90s → 1.29s (+43%) |     0ms → 0ms      |    0 → 0    | 0.90s → 1.29s |
| `/blog/react-server-components` | mobile  | 3.73s → 3.21s (−14%) | 5.32s → 6.23s (+17%) | 34ms → 21ms (−37%) |    0 → 0    | 6.24s → 6.57s |

### Bundle size (uncompressed total client JS)

| Build      | Total client JS | Notes                                                                                                |
| ---------- | --------------: | ---------------------------------------------------------------------------------------------------- |
| Real React |       21,052 KB | Dedicated `react-*.js` chunk = 176 KB (`manualChunks` splits `node_modules/react{,-dom}/`)           |
| Shim       |       20,072 KB | No dedicated react chunk; shim code inlines into `app-shell` (+16 KB there). Net **−980 KB (−4.7%)** |

## Caveats

- **Lab data only.** Chrome origin-level CWV (CrUX) needs ~28 days of real traffic before aggregates stabilize. Since the shim only went live on `2026-04-20`, field data won't be comparable for a month.
- **`pnpm start:prod` serves from Node locally — no CDN.** Absolute TTFB numbers are dev-machine noise (5ms–1s range depending on cold-cache loader work); anchor on client-side metrics.
- **Per-page LCP percentages can look dramatic when the absolute value is small.** Blog desktop LCP `0.90s → 1.29s` is +390 ms — real, but a sub-second LCP regression in both states is still a Core Web Vitals "Good" rating (<2.5s).
- **Single-node prod server — no edge, no warm cache.** Mobile Lighthouse runs with 4× CPU throttling are inherently high-variance.

## Reproduce

```bash
# React baseline
# 1) temporarily remove tanstackDom() plugin + serverVariantAliases in vite.config.ts
pnpm build
PORT=4000 pnpm start:prod &
# run 5 trials × 3 URLs × 2 form factors, save JSON to ./react/

# Shim
# 2) restore tanstackDom() plugin + serverVariantAliases
pnpm build
PORT=4000 pnpm start:prod &
# re-run, save JSON to ./shim/

# Aggregate medians + delta (parse JSON, compute median of numericValues per audit key)
```

See the shim side for the runner + aggregator scripts used (`/tmp/lh-compare/run.sh`, `/tmp/lh-compare/aggregate.mjs` at measurement time).

## Related shim work shipped with this comparison

- `@tanstack/react-dom@0.1.0-alpha.4`: `renderFunction`'s deferred-hydration branch now mirrors `renderLazy`'s ancestor-Suspense guard (`_awaitingLazyHydration`). Fixes duplicate-markup on RSC pages. Regression test: `tests/rsc-hydration-adopt.test.tsx`.
- `@tanstack/react-dom-server@0.1.0-alpha.4`: shell-chunk batching in `streamHtml` (reduces Node stream overhead ~3–4% on SSR bench).
- `@tanstack/dom-vite@0.1.0-alpha.5`: dep bump to pick up react-dom@alpha.4.
