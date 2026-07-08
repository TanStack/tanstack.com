# Forge Production Rollout

Target: internal Forge PoC on production, behind auth, the `forge` capability, and BYOK-only model usage.

## Hard Gates

- Forge routes, server functions, and API endpoints are enabled by default. Set `FORGE_ENABLED=false` only to disable the surface.
- Access requires the `forge` capability. `admin` still grants all capabilities through the existing auth model.
- Runs require a browser-provided BYOK key by default. TanStack-owned provider keys are not part of the first rollout.
- Forge runs through the TanStack AI sandbox runtime. The agent, filesystem, event stream, and preview server share the same sandbox/container.
- The user's browser-provided BYOK key is sealed client-side, forwarded to the run endpoint, unsealed server-side, and injected into the sandbox as `CODEX_API_KEY`.
- `FORGE_AUTH_BYPASS=true` disables Forge auth and capability checks for a proof host only. Keep it unset on the production domain.
- `FORGE_REQUIRE_BYOK=false` is only appropriate for a hosted proof path with an intentionally managed provider credential.

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

Forge preview URLs use the Sandbox SDK tunnels API over RPC transport. Local
development and production can fall back to quick `trycloudflare` tunnels, but
production should use named tunnels for stable per-chat hostnames. Set a
Cloudflare API token with Cloudflare Tunnel edit, DNS edit, and zone read
permissions when named tunnels should be enabled:

```sh
wrangler secret put CLOUDFLARE_API_TOKEN --name tanstack-com
```

If the token can see more than one account or zone, also set
`CLOUDFLARE_ACCOUNT_ID` and/or `CLOUDFLARE_ZONE_ID` so the Sandbox SDK can bind
named tunnel DNS records unambiguously.

`wrangler.jsonc` sets `SANDBOX_TRANSPORT=rpc`,
`FORGE_PREVIEW_TUNNEL_MODE=auto`, and `FORGE_PREVIEW_TUNNEL_PREFIX=forge`.
In `auto` mode Forge uses named tunnels when `CLOUDFLARE_API_TOKEN` is
available and quick tunnels otherwise.

Leave `FORGE_AUTH_BYPASS` unset on the production domain.

## Production-Like Local Dev

The default local dev command uses the TanStack AI sandbox runtime for Forge runs:

```sh
pnpm dev
```

It still runs on the local dev server, so local auth/session cookies, local database state, and dev-server module behavior can differ from production. The Forge run itself must still use the sandbox binding.

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
5. Set `CLOUDFLARE_API_TOKEN` if production should use stable named tunnel preview URLs.
6. Deploy or redeploy the site.
7. Smoke test `/forge/new` as an authorized user with BYOK.
8. Smoke test `/forge/new` as a normal authenticated user and verify access is denied.

## Known PoC Limits

- The first production rollout should stay internal while the sandbox-backed runtime hardens.
