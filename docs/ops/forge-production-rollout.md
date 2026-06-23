# Forge Production Rollout

Target: internal Forge PoC on production, behind auth, the `forge` capability, and BYOK-only model usage.

## Hard Gates

- Forge routes, server functions, and API endpoints require `FORGE_ENABLED=true` in production.
- Access requires the `forge` capability. `admin` still grants all capabilities through the existing auth model.
- Runs require a browser-provided BYOK key in production. TanStack-owned provider keys are not part of the first rollout.
- `FORGE_AGENT_HARNESS=codex-cli` is local-only. Production should use `FORGE_AGENT_HARNESS=tanstack-ai` or leave it unset.
- Keep `FORGE_ENABLE_CODEX_CLI` unset in production.

## Production DB Step

Run the idempotent SQL file before enabling the Cloudflare Worker flag:

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

Set these before turning on the route. Keep the sealing key as a Worker secret:

```txt
FORGE_ENABLED=true
FORGE_REQUIRE_BYOK=true
FORGE_AGENT_HARNESS=tanstack-ai
```

```sh
wrangler secret put FORGE_BYOK_SEALING_KEY --name tanstack-com
```

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

1. Deploy the code with `FORGE_ENABLED` absent or false.
2. Run `scripts/sql/forge-production-readiness.sql` against production Postgres.
3. Grant `forge` to the intended internal user or role.
4. Create or verify the `tanstack-forge-runtime` R2 bucket.
5. Set the Cloudflare Forge vars and `FORGE_BYOK_SEALING_KEY` Worker secret.
6. Deploy or redeploy the site.
7. Smoke test `/forge/new` as an authorized user with BYOK.
8. Smoke test `/forge/new` as a normal authenticated user and verify access is denied.

## Known PoC Limits

- Runtime state is still the local Forge runtime, not the TanStack AI sandbox PR runtime.
- Browser preview is disposable and rehydrated from the latest manifest.
- The first production rollout should stay internal until the sandbox-backed runtime replaces local runtime assumptions.
