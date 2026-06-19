# Cloudflare Workers Migration Spike

## Scope

This spike adds Cloudflare Workers deployment support for the current TanStack Start site while keeping Netlify config in place for rollback.

## Commands

```bash
pnpm run dev:cloudflare
pnpm run build:cloudflare
pnpm run preview:cloudflare
pnpm run build
pnpm test
pnpm exec wrangler deploy --name tanstack-com-staging --var SITE_URL:https://tanstack-com-staging.workers.dev
```

Use `pnpm run dev:cloudflare` for local Worker runtime parity checks. Use `pnpm run build:cloudflare` before deploy. Because the Vite plugin redirects Wrangler to the generated `dist/server/wrangler.json`, staging deploy was run with an explicit Worker name and var override:

```bash
pnpm run build:cloudflare && pnpm exec wrangler deploy --name tanstack-com-staging --var SITE_URL:https://tanstack-com-staging.workers.dev
```

## Required Cloudflare Secrets And Vars

Set secrets with `pnpm exec wrangler secret put <NAME>` for production. For this explicit-name staging spike, use `pnpm exec wrangler secret put <NAME> --name tanstack-com-staging`.

Required for full parity:

- `SITE_URL`
- `DATABASE_URL`
- `SESSION_SECRET`
- `GITHUB_AUTH_TOKEN`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `DISCORD_WEBHOOK_URL`
- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `RESEND_API_KEY`
- `SENTRY_DSN`
- `SHOPIFY_PRIVATE_STOREFRONT_TOKEN`
- `TANSTACK_MCP_ENABLED_TOOLS`
- `TANSTACK_LOCAL_REPOS_DIR`
- `APPLICATION_STARTER_PROVIDER`
- `APPLICATION_STARTER_MODEL`
- `APPLICATION_STARTER_ANALYSIS_MODEL`
- `APPLICATION_STARTER_PROMPT_MODEL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `MCP_API_KEY`
- `MCP_URL`
- `GITHUB_MCP_URL`
- `LINEAR_MCP_URL`
- `INTERNAL_MCP_URL`

Public client vars still come from Vite env:

- `VITE_KAPA_INTEGRATION_ID`
- `VITE_KAPA_SOURCE_GROUP_IDS`

No Workers bindings are required by this spike. If direct Postgres connections show production connection pressure, add Hyperdrive later and point `DATABASE_URL` at the Hyperdrive connection string.

## Verified Locally

Passed with `pnpm run dev:cloudflare`:

- `/` returns 200.
- `/start/latest/docs/framework/react/overview` redirects to `/start/latest/docs/framework/react`, then returns 200.
- `/builder` returns 200 and includes COOP/COEP headers.
- `/api/data/libraries` returns 200.
- `/api/og/query.png` returns a valid 1200x630 PNG.
- `/_a/gtag.js` proxies to Google Tag Manager with 200.
- `/_a/g/collect` proxies to Google Analytics with 204.
- `pnpm test` passes with 10 existing oxlint warnings.
- `pnpm run build` passes.
- `pnpm run build:cloudflare` passes.

Current blockers:

- Staging deploy fails Cloudflare Worker size validation. Wrangler reported the Worker at about 56 MiB raw / 13.4 MiB gzip and rejected it on the 3 MiB script limit. Largest reported modules were Takumi WASM twice, RSC router, and IslandExplorer chunks.
- Builder API routes that import `@tanstack/create` still fail in Workers. The eval issue is avoided with a Cloudflare-only `ejs` shim, but `@tanstack/create` reads template directories from package filesystem paths that are not available in the Worker bundle. Builder compile/download/deploy parity is not proven.
- Auth pages and GitHub OAuth callback were not fully verified because this worktree has no `.env.local`; local `/login` fails without `SESSION_SECRET`.
- DB-backed auth/session/API behavior still needs verification with real staging secrets.
- Discord/MCP endpoints still need verification with real secrets.

## Production Readiness

Core site SSR, docs, analytics proxying, security headers, builder isolation headers, static assets, and OG image generation are Worker-compatible in local dev. Production migration is not safe yet. The Worker currently cannot deploy under Cloudflare script-size limits, and builder `@tanstack/create` packaging plus secret-backed auth/DB checks still need resolution.
