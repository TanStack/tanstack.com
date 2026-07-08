import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(
  new URL('./sql/forge-production-readiness.sql', import.meta.url),
  'utf8',
)

const rollout = readFileSync(
  new URL('../docs/ops/forge-production-rollout.md', import.meta.url),
  'utf8',
)

const wranglerConfig = readFileSync(
  new URL('../wrangler.jsonc', import.meta.url),
  'utf8',
)

const requiredSqlSnippets = [
  "ALTER TYPE capability ADD VALUE IF NOT EXISTS 'forge'",
  'CREATE TABLE IF NOT EXISTS forge_projects',
  'CREATE TABLE IF NOT EXISTS forge_chat_sessions',
  'forge_projects_user_runtime_project_unique',
  'forge_chat_sessions_runtime_session_id_unique',
  'forge_chat_sessions_project_updated_idx',
  'forge_chat_sessions_user_updated_idx',
]

for (const snippet of requiredSqlSnippets) {
  assert.ok(sql.includes(snippet), `Missing SQL snippet: ${snippet}`)
}

assert.equal(
  /\bBEGIN\b/i.test(sql),
  false,
  'Do not wrap ALTER TYPE ADD VALUE in an explicit transaction.',
)

const requiredRolloutSnippets = [
  'FORGE_ENABLED=false',
  'Runs require a browser-provided BYOK key by default.',
  'Forge runs through the TanStack AI sandbox runtime.',
  'injected into the sandbox as `CODEX_API_KEY`',
  'FORGE_BYOK_SEALING_KEY',
  'CLOUDFLARE_API_TOKEN',
  'SANDBOX_TRANSPORT=rpc',
  'FORGE_PREVIEW_TUNNEL_MODE=auto',
  'FORGE_AUTH_BYPASS',
  'Leave `FORGE_AUTH_BYPASS` unset on the production domain.',
  'psql "$DATABASE_URL" -f scripts/sql/forge-production-readiness.sql',
  'sandbox-backed runtime hardens',
]

for (const snippet of requiredRolloutSnippets) {
  assert.ok(rollout.includes(snippet), `Missing rollout snippet: ${snippet}`)
}

const requiredWranglerSnippets = [
  '"FORGE_RUNTIME"',
  '"tanstack-forge-runtime"',
  '"FORGE_SESSIONS"',
  '"ForgeSessionDurableObject"',
  '"new_sqlite_classes"',
  '"SANDBOX_TRANSPORT": "rpc"',
  '"FORGE_PREVIEW_TUNNEL_MODE": "auto"',
]

for (const snippet of requiredWranglerSnippets) {
  assert.ok(
    wranglerConfig.includes(snippet),
    `Missing Wrangler config snippet: ${snippet}`,
  )
}

console.log('Forge production readiness verifier passed')
