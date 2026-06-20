# Cloudflare Workers Migration Spike

Cloudflare Workers support is wired for the current TanStack.com Start app while Netlify config remains in place for rollback.

## Files Changed

- `package.json`, `pnpm-lock.yaml`: `@tanstack/create@^0.68.3`, Cloudflare deploy scripts with build-time `SITE_URL`/`VITE_SITE_URL`.
- `vite.config.ts`: Cloudflare target switch and server builder-generation define.
- `wrangler.jsonc`: Worker config, assets binding, `nodejs_compat`, staging vars.
- `src/builder/api/*`: worker-friendly `@tanstack/create/edge` imports, local attribution/template helpers, remote add-on edge import.
- `src/components/builder/*`, `src/components/application-builder/*`: client-side builder feature loading, ZIP generation, and GitHub deploy file handoff.
- `src/routes/api/builder/*`: Cloudflare-safe 501 responses for server-generation-only builder routes; GitHub deploy accepts precompiled client files.
- `src/utils/env.ts`, `src/utils/seo.ts`: generic `VITE_SITE_URL` support so staging client/server canonical URLs match.
- `src/tanstack-start.d.ts`, `src/types/tanstack-create-edge.d.ts`: build flag and private edge import declarations.

Earlier migration work in this branch also added the host runtime adapter, OG image Worker compatibility, Cloudflare headers/redirects, and Island Explorer client-only handling.

## Commands Used

```bash
pnpm run build
pnpm test
SITE_URL=https://tanstack-com-staging.thetanstack.workers.dev VITE_SITE_URL=https://tanstack-com-staging.thetanstack.workers.dev pnpm run build:cloudflare
pnpm exec wrangler deploy --name tanstack-com-staging --var SITE_URL:https://tanstack-com-staging.thetanstack.workers.dev
pnpm run with-env -- sh -c 'DISABLE_REDACT=true TANSTACK_DEPLOY_TARGET=cloudflare vite dev --host 127.0.0.1 --port 3001'
node --input-type=module -e "const { compileHandler } = await import('./dist/client/assets/compile-Bgcl59oJ.js'); const result = await compileHandler({ name: 'my-tanstack-app', framework: 'react', packageManager: 'pnpm', tailwind: true, features: ['cloudflare'], featureOptions: {} }); console.log(Object.keys(result.files).length)"
```

Representative staging checks used `curl` against `/`, docs, `/builder`, `/login`, `/auth/github/start`, `/api/data/libraries`, `/api/og/query.png`, analytics proxy routes, Discord interactions, MCP, stats, and builder API routes.

## Staging

- Account: `8da95258a9c70b54c3e2b374a0079106`
- Worker: `tanstack-com-staging`
- URL: `https://tanstack-com-staging.thetanstack.workers.dev`
- Current version: `5f53ee15-451a-452d-88f1-241f2627de6f`
- Upload size: `26939.40 KiB` raw, `8512.56 KiB` gzip
- Startup time: `23 ms`

This fits the paid Workers 10 MiB gzip limit.

## Passed

- `pnpm run build` passed.
- `pnpm test` passed with 10 existing oxlint warnings.
- Staging Cloudflare build passed.
- Staging deploy passed.
- Server bundle no longer contains the generated `@tanstack/create` manifest strings checked during the size investigation.
- `/builder` hydrates on staging and loads the client builder chunks.
- Browser builder smoke: default Cloudflare starter UI renders, no console warnings/errors, generated prompt flow works.
- Local browser-built `compileHandler` generated a 21-file Cloudflare starter including `package.json` and `wrangler.jsonc`.

Staging route checks:

- `/` 200 HTML.
- `/start/latest/docs/framework/react/overview` 200 HTML.
- `/builder` 200 HTML with COOP/COEP/security headers.
- `/login` 200 HTML.
- `/auth/github/start` 302 to GitHub with staging callback URL.
- `/api/data/libraries` 200 JSON.
- `/api/og/query.png` 200 PNG.
- `/_a/gtag.js` 200 JavaScript.
- `/_a/g/collect` 204.
- `/stats/npm/%40tanstack%2Freact-query` redirects then 200 HTML.
- `/.well-known/oauth-authorization-server` 200 JSON.
- `POST /api/discord/interactions` returns expected 401 for unsigned request.
- `/api/builder/features` and `/api/builder/download` return intentional 501 JSON on Cloudflare.

## Failed Or Not Proven

- `pnpm run dev:cloudflare` did not bind to `127.0.0.1:3001` after 60 seconds in this worktree.
- `GET /api/mcp` still returns 500 JSON: `HTTPError`.
- Full GitHub OAuth callback was not completed.
- Authenticated account/admin flows were not manually verified.
- Browser wrapper did not observe the blob ZIP download event, although the browser-built compile handler itself succeeds.
- GitHub deploy was not completed end-to-end; server route is ready to accept client-generated files.

## Readiness

Core marketing SSR, docs SSR, login rendering, auth start cookies/redirect, analytics proxying, security headers, static assets, OG image generation, DB-backed stats pages, Discord request validation, and the Builder UI are Worker-compatible on staging.

Production cutover is closer but not fully safe yet. Remaining blockers are local Cloudflare dev startup, MCP 500, authenticated OAuth/account verification, and an end-to-end Builder ZIP/GitHub deploy check in a browser environment that can observe downloads.
