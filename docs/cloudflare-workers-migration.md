# Cloudflare Workers Migration Report

TanStack.com is configured as a Cloudflare Workers deployment for this branch. Netlify is no longer part of this site's hosting configuration, but Netlify remains available in builder/deploy-provider UX for users who choose it.

## Files Changed

- `package.json`, `pnpm-lock.yaml`: Cloudflare build/preview/deploy scripts, `@cloudflare/vite-plugin`, `wrangler`, and removal of Netlify hosting packages.
- `vite.config.ts`: Cloudflare Vite plugin, Worker build constants, opt-in image transformation flag, and server builder-generation disabled for Worker size.
- `wrangler.jsonc`: Worker name/account, assets binding, `nodejs_compat`, CPU limit, cron triggers, and production `SITE_URL`.
- `src/server.ts`, `src/server/scheduled.server.ts`: Worker `fetch` and `scheduled` entrypoints, replacing former Netlify scheduled functions.
- `src/server/runtime/host.server.ts`, `src/utils/hosting-cache.server.ts`: host cache purge adapter using Cloudflare cache-tag purge.
- `src/components/OptimizedImage.tsx`, `src/utils/optimizedImage.ts`: host-neutral optimized image helper with Cloudflare image transformations behind an explicit build flag.
- `src/routes/api/builder/*`, `src/components/builder/*`: builder deploy/download path uses browser-generated files; direct server-generation endpoints return explicit 501 on Workers.
- `src/routes/*`, `src/utils/*`, `src/server/*`: CDN cache headers moved from Netlify-specific headers to portable `CDN-Cache-Control` / `Cache-Tag`.
- `src/utils/markdown/processor.ts`: site-side compatibility guard for escaped angle brackets in generated TypeDoc markdown until `@tanstack/markdown` handles `\<...\>` as escaped text.
- `package.json`, `pnpm-lock.yaml`: `@tanstack/markdown@0.0.5` for compact table delimiters, footnotes, and legacy single-tilde strike headings without the temporary pnpm patch.
- Removed hosting-only Netlify files: `netlify.toml`, `netlify/functions/*`, `scripts/run-built-server.mjs`.

## Commands Used

```bash
pnpm install --lockfile-only
pnpm run test:tsc
pnpm run build:cloudflare
pnpm test
pnpm run deploy:cloudflare
pnpm run preview:cloudflare -- --host 127.0.0.1 --port 3001
pnpm install
```

Additional checks used `curl`, Node fetch scripts, Wrangler tail, and Playwright with system Chrome against the Workers preview URL.

## Worker

- Account: `8da95258a9c70b54c3e2b374a0079106`
- Worker: `tanstack-com`
- URL: `https://tanstack-com.thetanstack.workers.dev`
- Current version: `586b99ec-4a2c-46d2-b3b3-eb775de13141`
- Upload size: `14609.48 KiB` raw, `4736.36 KiB` gzip
- Startup time: `29 ms`
- Note: the secret-bearing `tanstack-com-staging` Worker was renamed to `tanstack-com`, and the older empty `tanstack-com` Worker was removed.

## Passed

- `pnpm run build:cloudflare` passed.
- `pnpm run test:tsc` passed.
- `pnpm test` passed with 10 existing oxlint warnings.
- Cloudflare deploy passed.
- Local Cloudflare preview started and returned 200 for `/` and `/builder`.
- `/` returned 200 HTML on the Worker.
- `/start/latest` returned 200 HTML on the Worker.
- Browser SPA navigation from `/` to `/start/latest` did not reproduce the `npm-recent-downloads ... data is undefined` error.
- `/builder` returned 200 HTML with COOP/COEP headers and loaded the client builder/integration surface.
- Primary homepage images loaded in browser on the Worker.
- `/api/og/query.png?title=Query&description=Smoke` returned a valid 1200x630 PNG.
- `/_a/gtag.js` returned Google's JavaScript.
- `/_a/g/collect` returned 204.
- `/auth/github/start?returnTo=/account` redirected to GitHub with secure state/return cookies.
- `/.well-known/oauth-authorization-server` returned OAuth metadata.
- `/api/mcp/` returned the expected unauthenticated JSON-RPC auth error instead of a runtime failure.
- `POST /api/application-starter/resolve` returned a Start recipe.
- `Link` response headers for static assets are emitted on SSR responses for Cloudflare Early Hints fallback.
- Broad docs/blog audit generated 2,767 latest-doc/blog URLs from GitHub doc trees plus local blog posts and compared production vs Worker.
- Escaped generic headings in TypeDoc markdown now render correctly, e.g. `Interface: AudioAdapter<TModel, TProviderOptions>` with the production-compatible `interface-audioadaptertmodel-tprovideroptions` anchor.
- Local site parser checks now match the remaining markdown audit diffs:
  - `/ai/latest/docs/code-mode/code-mode` parses 4 content tables.
  - `/db/latest/docs/collections/powersync-collection` parses 24 content tables.
  - `/start/latest/docs/framework/react/migrate-from-next-js` headings render as `Server Actions Functions` and `Server Routes Handlers`.
  - `/blog/tanstack-router-signal-graph` renders footnotes with `data-footnotes` and production-compatible footnote anchors.
- Live Worker rechecks against production passed for the same table, heading, and footnote signals after deploying version `586b99ec-4a2c-46d2-b3b3-eb775de13141`.
- Three full-body rechecks of 43 URLs that intermittently returned Worker 500/timeout during the high-concurrency audit cleared; the only stable non-200s were `/hotkeys/latest/docs/reference` and `/pacer/latest/docs/reference`, both 404 on production and Worker.

## Failed Or Not Proven

- Direct server-side builder generation endpoints return 501 on Workers:
  - `/api/builder/features`
  - `/api/builder/compile`
  - `/api/builder/compile-attributed`
  - `/api/builder/download`
  - `/api/builder/validate`
  - `/api/builder/feature-artifacts`
- Full GitHub OAuth callback/account login was not completed.
- End-to-end GitHub repository deploy was not completed with a logged-in account.
- Cron trigger behavior was deployed but not manually invoked.
- High-concurrency audit runs can still produce transient Worker 500s with `{"status":500,"unhandled":true,"message":"HTTPError"}` on changing docs paths, but targeted full-body rechecks did not reproduce stable page failures. Treat this as a load/audit-cache risk, not a confirmed content regression.

## Builder Generation Note

The released `@tanstack/create@0.68.3` `edge` import is Worker-runtime compatible, but it still statically imports the generated create manifest. That manifest made the Worker upload `11222.23 KiB` gzip, over the paid 10 MiB Worker script limit.

The deployable compromise in this branch keeps dynamic generation in the browser for the builder UI, downloads, and GitHub deploy handoff, and excludes server-side create generation from the Worker bundle. After that change, the Worker upload is `4804.51 KiB` gzip.

## Image Transformation Note

Cloudflare image transformations are disabled by default because `/cdn-cgi/image/*` returned 404 on the Worker preview URL before custom-domain image resizing was proven. Set `TANSTACK_IMAGE_TRANSFORMATIONS=true` during build only after Image Resizing works on the routed `tanstack.com` zone.

## Markdown Audit Note

The new markdown renderer initially parsed escaped TypeDoc generics like `\<T\>` as inline HTML. The site now protects escaped `<` / `>` outside code fences and inline code before parsing, restores them into text nodes before render, and rebuilds headings so rendered content and ToC anchors stay aligned.

Resolved markdown differences from the broad audit:

- Escaped TypeDoc generics no longer become inline HTML.
- Compact markdown table delimiters like `:--:` now parse as tables, matching the existing production renderer.
- Blog footnotes now render with `data-footnotes`, `user-content-fn-*`, and `user-content-fnref-*` anchors.
- Legacy single-tilde strike headings now render without visible `~` markers.

Remaining markdown differences observed during audit:

- Production duplicates light/dark code blocks; the Worker branch renders one theme-aware code block. This explains large HTML-size and `<pre>` count differences.
- The temporary `@tanstack/markdown@0.0.4` pnpm patch has been removed after upgrading to `@tanstack/markdown@0.0.5`.

## Readiness

Core marketing SSR, docs/start navigation, security headers, static assets, analytics proxying, GitHub auth start, MCP auth rejection, application-starter API, scheduled Worker registration, Cloudflare preview, deploy, and dynamic OG image generation are working on Cloudflare Workers.

Production migration is close, but not fully safe until logged-in OAuth/account flows, cron jobs, and an authenticated builder GitHub deploy are verified. The biggest remaining product parity decision is whether direct server-side builder generation APIs must be supported on the Worker; supporting them requires a smaller create manifest/runtime from `@tanstack/create` or a separate generation service.
