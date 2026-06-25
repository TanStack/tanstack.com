# Forge Production Rollout

Target: internal Forge PoC on production, behind auth, the `forge` capability, and BYOK-only model usage.

## Hard Gates

- Forge routes, server functions, and API endpoints are enabled by default. Set `FORGE_ENABLED=false` only to disable the surface.
- Access requires the `forge` capability. `admin` still grants all capabilities through the existing auth model.
- Runs require a browser-provided BYOK key by default. TanStack-owned provider keys are not part of the first rollout.
- Local dev uses Codex CLI by default so `pnpm dev` does not spend server-side provider tokens.
- Production uses the TanStack AI harness by default.
- `FORGE_AGENT_HARNESS=codex-cli` is local-only. Set `FORGE_AGENT_HARNESS=cloudflare-workers-ai` only for the Cloudflare Workers AI proof path, or `FORGE_AGENT_HARNESS=tanstack-ai` for explicit local production-like testing.
- `FORGE_AUTH_BYPASS=true` disables Forge auth and capability checks for a proof host only. Keep it unset on the production domain.
- `FORGE_REQUIRE_BYOK=false` is only appropriate for a hosted proof path backed by a server-side harness such as Cloudflare Workers AI.
- Keep `FORGE_ENABLE_CODEX_CLI` unset in production.

## Production DB Step

Run the idempotent SQL file before deploying Forge to production:

```sh
psql "$DATABASE_URL" -f scripts/sql/forge-production-readiness.sql
```

Verify:

```sql
SELECT 'forge'::capability;
SELECT to_regclass('public.forge_projects');
SELECT to_regclass('public.forge_chat_sessions');
```

Grant access only to selected users or roles after the enum exists. For a direct user grant:

```sql
UPDATE users
SET capabilities = array_append(capabilities, 'forge'::capability),
    updated_at = now()
WHERE email = '<user@example.com>'
  AND NOT ('forge'::capability = ANY(capabilities));
```

## Cloudflare Worker Env

Set the sealing key as a Worker secret:

```sh
wrangler secret put FORGE_BYOK_SEALING_KEY --name tanstack-com
```

Leave `FORGE_AUTH_BYPASS` unset on the production domain.

## Production-Like Local Dev

The default local dev command uses Codex CLI for Forge runs:

```sh
pnpm dev
```

For API-backed production-like testing on the local dev server, explicitly use
the TanStack AI harness and disable BYOK only for that test run:

```sh
FORGE_AGENT_HARNESS=tanstack-ai FORGE_REQUIRE_BYOK=false pnpm dev
```

It still runs on the local dev server, so it is not identical to the deployed
Worker. Local auth/session cookies, local database state, and dev-server module
behavior can still differ. It is the right mode for route guards, Forge server
functions, chat metadata, stream projection, and UI behavior.

Confirm `SESSION_SECRET` is stable. Forge can seal BYOK with `SESSION_SECRET`, but production should use the dedicated `FORGE_BYOK_SEALING_KEY`.

Do not add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for the first rollout. Provider credentials should come from the user BYOK menu.

## Cloudflare Bindings

Forge now has first-class Worker bindings for durable runtime state:

- `FORGE_RUNTIME`: R2 bucket for content-addressed file blobs, manifest snapshots, and session state/timeline snapshots.
- `FORGE_SESSIONS`: Durable Object namespace for per-session timeline/state ownership.

Create the R2 bucket before deploy if it does not already exist:

```sh
wrangler r2 bucket create tanstack-forge-runtime
```

The `ForgeSessionDurableObject` class and SQLite migration are declared in `wrangler.jsonc`.

## Deployment Order

1. Run `scripts/sql/forge-production-readiness.sql` against production Postgres.
2. Grant `forge` to the intended internal user or role.
3. Create or verify the `tanstack-forge-runtime` R2 bucket.
4. Set the `FORGE_BYOK_SEALING_KEY` Worker secret.
5. Deploy or redeploy the site.
6. Smoke test `/forge/new` as an authorized user with BYOK.
7. Smoke test `/forge/new` as a normal authenticated user and verify access is denied.

## Known PoC Limits

- Runtime state is still the local Forge runtime, not the TanStack AI sandbox PR runtime.
- Browser preview is disposable and rehydrated from the latest manifest.
- The first production rollout should stay internal until the sandbox-backed runtime replaces local runtime assumptions.
