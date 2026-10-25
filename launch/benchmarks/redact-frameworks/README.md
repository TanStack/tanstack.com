# React and Redact client bundles

Measured October 25, 2026 with the same counter component, controlled input, and CSS in four single-route apps. Each pair changes only the renderer integration. The landing page uses these measurements, with one shared scale for all eight bars.

| Framework      |    React |   Redact |          Saved |
| -------------- | -------: | -------: | -------------: |
| TanStack Start | 109.3 KB |  62.3 KB | 47.0 KB, 43.0% |
| Vite           |  68.3 KB |  20.1 KB | 48.1 KB, 70.5% |
| Vinext         | 138.1 KB |  98.8 KB | 39.3 KB, 28.5% |
| Next.js        | 175.6 KB | 139.9 KB | 35.7 KB, 20.4% |

These are starter app measurements. A larger app has its own routes, dependencies, and chunk layout, so its percentage will differ. The separate [Vinext benchmark](https://github.com/TanStack/redact/blob/main/benchmarks/VINEXT_BENCHMARKS.md) measures a larger workload over six rounds and saves 39.4 KB, or 25.4%.

## What the numbers include

Each file is compressed separately with Node's default `gzipSync`, then the sizes are added. We count all emitted client JavaScript and CSS, including lazy chunks and framework polyfills. KB means 1,000 bytes. These totals are not the download for a single navigation. HTML, inline scripts and Flight payloads, images, source maps, and server output are excluded.

Start and Vite use Redact's default Vite integration. Start sets `ssr.noExternal: true` in both builds. This lets Vite transform React imports inside server dependencies as well as application code. Without it, Node can load an external dependency with native React alongside application code using Redact. Next.js uses `withRedact` with Turbopack. Vinext uses the maintained integration in both modes, with `renderer: 'react'` or `renderer: 'redact'`, so both builds receive the same platform corrections. Next.js and Vinext keep native React on the server. No presets, feature flags, minifier settings, or application code are changed between the two builds of a framework.

This is one clean production build per variant, measuring bytes rather than speed. All eight builds were opened in the browser and checked for client startup, a counter update, a controlled input update, and the expected renderer. Start, Vinext, and Next.js were also checked for server-rendered content before JavaScript ran. See [browser checks](./browser-checks.json) and [server checks](./server-checks.json).

## Versions and source

- React and React DOM 19.3.1 in every app.
- TanStack Start 1.168.60 and Router 1.170.41.
- Vite 8.3.5, React plugin 6.1.2, and RSC plugin 0.5.38.
- Vinext 1.3.0 and Next.js 16.4.3.
- Node 24.22.0, macOS arm64.
- Redact's 0.2.0 release candidate at [1666d37](https://github.com/TanStack/redact/tree/1666d37ba48c9fbb02e88769ca03d9234a640a76). Its package still identifies itself as 0.1.5 until Changesets versions the release. Tarball SHA-256: `6f8592d92061ab3845b11a5635a2853ec5ba61b600f7ca213cfa42b510ec1099`.

[Raw results](./results.json) include every emitted file's size and SHA-256, package versions, component and CSS hashes, and the dependency lockfile hash. The [page data](../../../src/data/redact-framework-sizes.json) retains exact byte totals, and the UI calculates its KB, percentages, and bar lengths from those totals.

## Reproduce

Use a new directory, copy this folder's `package.json` and `package-lock.json` into it, and place the candidate tarball there as `redact.tgz`. Then run with Node 24.22.0:

```sh
npm ci --no-audit --no-fund
node /path/to/measure.mjs "$PWD"
node /path/to/serve.mjs "$PWD"
```

`measure.mjs` generates every fixture from source, builds React then Redact for each framework, records `results.json`, and preserves all eight builds. `serve.mjs` opens local production previews on ports 4380 through 4387, in the order Start, Vite, Vinext, and Next.js, React first in each pair. The small Node HTTP bridge for Start and Vite is only a preview harness and is not part of the measured output.
