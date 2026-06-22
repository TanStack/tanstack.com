# Cloudflare Workers Migration Report

TanStack.com is configured as a Cloudflare Workers deployment for this branch. Netlify is no longer part of this site's hosting configuration, but Netlify remains available in builder/deploy-provider UX for users who choose it.

## Files Changed

- `package.json`, `pnpm-lock.yaml`: Cloudflare build/preview/deploy scripts, `@cloudflare/vite-plugin`, `wrangler`, and removal of Netlify hosting packages.
- `vite.config.ts`: Cloudflare Vite plugin, Worker build constants, Cloudflare image transformation flag, and server builder-generation disabled for Worker size.
- `wrangler.jsonc`: Worker name/account, assets binding, `nodejs_compat`, CPU limit, cron triggers, staging vars.
- `src/server.ts`, `src/server/scheduled.server.ts`: Worker `fetch` and `scheduled` entrypoints, replacing former Netlify scheduled functions.
- `src/server/runtime/host.server.ts`, `src/utils/hosting-cache.server.ts`: host cache purge adapter using Cloudflare cache-tag purge.
- `src/components/OptimizedImage.tsx`, `src/utils/optimizedImage.ts`: host-neutral optimized image helper backed by Cloudflare image transformations in production.
- `src/routes/api/builder/*`, `src/components/builder/*`: builder deploy/download path uses browser-generated files; direct server-generation endpoints return explicit 501 on Workers.
- `src/routes/*`, `src/utils/*`, `src/server/*`: CDN cache headers moved from Netlify-specific headers to portable `CDN-Cache-Control` / `Cache-Tag`.
- Removed hosting-only Netlify files: `netlify.toml`, `netlify/functions/*`, `scripts/run-built-server.mjs`.

## Commands Used

```bash
pnpm install --lockfile-only
pnpm run test:tsc
pnpm run build:cloudflare
pnpm test
pnpm run deploy:cloudflare:staging
pnpm run preview:cloudflare -- --host 127.0.0.1 --port 3001
```

Additional checks used `curl` and Playwright with system Chrome against `https://tanstack-com-staging.thetanstack.workers.dev`.

## Staging

- Account: `8da95258a9c70b54c3e2b374a0079106`
- Worker: `tanstack-com-staging`
- URL: `https://tanstack-com-staging.thetanstack.workers.dev`
- Current version: `1eee9b37-74c8-4232-bb6c-f5c755e0855d`
- Upload size: `14872.99 KiB` raw, `4804.51 KiB` gzip
- Startup time: `30 ms`

## Passed

- `pnpm run build:cloudflare` passed.
- `pnpm run test:tsc` passed.
- `pnpm test` passed with 10 existing oxlint warnings.
- Staging deploy passed.
- Local Cloudflare preview started and returned 200 for `/` and `/builder`.
- `/` returned 200 HTML on staging.
- `/start/latest` returned 200 HTML on staging.
- Browser SPA navigation from `/` to `/start/latest` did not reproduce the `npm-recent-downloads ... data is undefined` error.
- `/builder` returned 200 HTML with COOP/COEP headers and loaded the client builder/integration surface.
- Primary homepage images loaded in browser on staging.
- `/api/og/query.png?title=Query&description=Smoke` returned a valid 1200x630 PNG.
- `/_a/gtag.js` returned Google's JavaScript.
- `/_a/g/collect` returned 204.
- `/auth/github/start?returnTo=/account` redirected to GitHub with secure state/return cookies and the staging callback URL.
- `/.well-known/oauth-authorization-server` returned OAuth metadata with the staging issuer.
- `/api/mcp/` returned the expected unauthenticated JSON-RPC auth error instead of a runtime failure.
- `POST /api/application-starter/resolve` returned a Start recipe.

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
- Cron trigger behavior was deployed but not manually invoked in staging.

## Builder Generation Note

The released `@tanstack/create@0.68.3` `edge` import is Worker-runtime compatible, but it still statically imports the generated create manifest. That manifest made the Worker upload `11222.23 KiB` gzip, over the paid 10 MiB Worker script limit.

The deployable compromise in this branch keeps dynamic generation in the browser for the builder UI, downloads, and GitHub deploy handoff, and excludes server-side create generation from the Worker bundle. After that change, the Worker upload is `4804.51 KiB` gzip.

## Readiness

Core marketing SSR, docs/start navigation, security headers, static assets, analytics proxying, GitHub auth start, MCP auth rejection, application-starter API, scheduled Worker registration, Cloudflare preview, staging deploy, and dynamic OG image generation are working on Cloudflare Workers.

Production migration is close, but not fully safe until logged-in OAuth/account flows, cron jobs, and an authenticated builder GitHub deploy are verified. The biggest remaining product parity decision is whether direct server-side builder generation APIs must be supported on the Worker; supporting them requires a smaller create manifest/runtime from `@tanstack/create` or a separate generation service.
