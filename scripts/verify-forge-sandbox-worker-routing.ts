import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// `src/server.ts` imports `@cloudflare/sandbox` directly (for `Sandbox` and
// `proxyToSandbox`), which — like `@tanstack/ai-sandbox-cloudflare` in
// `verify-forge-sandbox-definition.ts` — statically imports
// `cloudflare:workers` the moment the module graph loads at all, with no
// environment-conditional export. That module specifier only exists inside
// the real Workers runtime (or under `wrangler`/`vitest-pool-workers`),
// neither of which this repo's plain `tsx`-based `test:forge-*` scripts use.
// So this verifier proves two independent things instead of one live call:
//
// 1. `src/server.ts` is at least *importable* under `tsx` up to the point
//    where the Workers-runtime-only module graph bottoms out — confirmed as
//    a controlled failure mode below, matched by error message so an
//    unrelated regression still fails loudly.
// 2. Everything that actually matters for this task — that
//    `proxyToSandbox(...)` runs and resolves BEFORE the TanStack Start
//    fallthrough, that `Sandbox`/`ContainerProxy` are exported from the
//    entrypoint, and that `RunCoordinator` is never referenced — is asserted
//    statically against the `server.ts` SOURCE text, ordering included.
let importError: unknown
try {
  await import('../src/server')
} catch (error) {
  importError = error
}

assert.ok(
  importError instanceof Error &&
    /cloudflare:|@cloudflare\/(containers|sandbox)/.test(importError.message),
  `expected the only possible import failure to be the known Workers-runtime-only gap, got: ${String(importError)}`,
)
console.log(
  '[verify-forge-sandbox-worker-routing] src/server.ts cannot load under plain tsx (Workers-runtime-only import chain via @cloudflare/sandbox) — verifying fetch-chain wiring statically against source instead.',
)

const serverSource = readFileSync(
  new URL('../src/server.ts', import.meta.url),
  'utf8',
)
const forgeRouteSource = readFileSync(
  new URL('../src/routes/forge.tsx', import.meta.url),
  'utf8',
)
const forgeChatApiSource = readFileSync(
  new URL('../src/routes/api/forge/chat.ts', import.meta.url),
  'utf8',
)
const localAgentSource = readFileSync(
  new URL('../src/builder/runtime/local-agent.server.ts', import.meta.url),
  'utf8',
)

// 1. `Sandbox` (the @cloudflare/sandbox container-host DO class) and
//    `ContainerProxy` must be exported as concrete entrypoint classes so
//    wrangler's `class_name: "Sandbox"` binding resolves and sandbox
//    outbound interception can find `ctx.exports.ContainerProxy`.
assert.ok(
  /\bContainerProxy\b/.test(serverSource) &&
    /Sandbox\s+as\s+CloudflareSandbox/.test(serverSource) &&
    /export\s*\{\s*ContainerProxy\s*\}/.test(serverSource) &&
    /export\s+class\s+Sandbox\s+extends\s+CloudflareSandbox/.test(serverSource),
  'expected SDK ContainerProxy export and concrete Sandbox entrypoint class export in src/server.ts',
)
assert.ok(
  !/export\s*\{[^}]*\bSandbox\b[^}]*\}\s*from\s*['"]@cloudflare\/sandbox['"]/.test(
    serverSource,
  ),
  'expected src/server.ts not to rely on the old bare Sandbox re-export',
)

// 2. The existing `ForgeSessionDurableObject` re-export must still be there
//    — this task adds to the fetch chain, it does not replace it.
assert.ok(
  serverSource.includes(
    "export { ForgeSessionDurableObject } from '~/builder/runtime/forge-session-do.server'",
  ),
  'expected the existing ForgeSessionDurableObject re-export to remain untouched',
)

// 3. `proxyToSandbox` must be imported from `@cloudflare/sandbox`.
assert.ok(
  /import\s*\{[^}]*proxyToSandbox[^}]*\}\s*from\s*['"]@cloudflare\/sandbox['"]/.test(
    serverSource,
  ),
  'expected proxyToSandbox to be imported from @cloudflare/sandbox',
)

// 4. `proxyToSandbox(...)` must be called, and a proxied result must be
//    returned before the Start handler fallthrough — checked within the
//    exported Workers entrypoint (`export default { async fetch(request, env)
//    { ... } }`), which is the actual fetch chain Workers invokes. The result
//    can pass through `repairBlockedForgePreviewRequest(...)` so blocked Vite
//    host responses can be repaired without letting preview traffic reach the
//    Start app.
const exportDefaultIndex = serverSource.indexOf('export default {')
assert.ok(
  exportDefaultIndex !== -1,
  'expected an `export default { ... }` Workers entrypoint in src/server.ts',
)

const exportDefaultBlock = serverSource.slice(exportDefaultIndex)

const proxyCallIndex = exportDefaultBlock.indexOf('proxyToSandbox(')
assert.ok(
  proxyCallIndex !== -1,
  'expected a call to proxyToSandbox( inside the export default Workers entrypoint in src/server.ts',
)

const proxyCallSlice = exportDefaultBlock.slice(proxyCallIndex)
assert.ok(
  /return\s+(?:proxied|repairBlockedForgePreviewRequest\()/.test(
    proxyCallSlice.slice(0, 320),
  ),
  'expected the proxyToSandbox(...) result to be returned, either directly or through repairBlockedForgePreviewRequest(...), shortly after the call',
)

assert.ok(
  serverSource.includes('async function repairBlockedForgePreviewRequest('),
  'expected repairBlockedForgePreviewRequest(...) to be defined in src/server.ts',
)

// The fallthrough out of `export default`'s fetch is a delegate call to the
// TanStack Start server entry (`server.fetch(` — itself `createServerEntry`
// wrapping `handler.fetch`). It must appear after proxyToSandbox(.
const fallthroughIndex = exportDefaultBlock.indexOf('server.fetch(')
assert.ok(
  fallthroughIndex !== -1,
  'expected a fallthrough call to server.fetch( inside the export default Workers entrypoint in src/server.ts',
)

assert.ok(
  proxyCallIndex < fallthroughIndex,
  `expected proxyToSandbox( (index ${proxyCallIndex} within export default) to appear BEFORE the Start fallthrough server.fetch( (index ${fallthroughIndex} within export default)`,
)

// And the Start handler itself (`handler.fetch(`, the TanStack Start
// fallthrough used inside `server`'s wrapped fetch) must exist somewhere in
// the file, confirming the fallthrough path still terminates in the real
// Start handler rather than being severed.
assert.ok(
  serverSource.includes('handler.fetch('),
  'expected the TanStack Start fallthrough handler.fetch( to still be present in src/server.ts',
)

// 5. Must NOT reference RunCoordinator anywhere — forge drives the
//    coding-agent run in its own runtime, not via the sandbox package's
//    RunCoordinator DO.
assert.ok(
  !serverSource.includes('RunCoordinator'),
  'expected src/server.ts to NOT reference RunCoordinator',
)

assert.ok(
  !serverSource.includes('.wsConnect('),
  'expected preview WebSocket traffic to flow through proxyToSandbox(...), not a custom sandbox.wsConnect(...) bridge',
)

// 6. Locally persisted quick-tunnel preview URLs are ephemeral DNS names. They
//    must be migrated to deterministic worker-preview URLs, while a live
//    worker-preview iframe must be left alone during active follow-up runs so
//    Vite HMR can update it in place.
assert.ok(
  /function\s+shouldReconnectForgeSandboxPreviewUrl\([\s\S]*?if\s*\(\s*previewUrl\s*\)\s*\{\s*return\s+isLocalForgeQuickTunnelPreviewUrl\(previewUrl\)\s*\}[\s\S]*?if\s*\(\s*isActiveForgeRunStatus\(latestRun\?\.status\)\s*\)\s*\{\s*return\s+false\s*\}[\s\S]*?return\s+Boolean\(latestRun\)/.test(
    forgeRouteSource,
  ),
  'expected Forge UI reconnect logic to migrate stale local trycloudflare preview URLs without touching active worker-preview iframes',
)
assert.ok(
  /function\s+isLocalForgeQuickTunnelPreviewUrl\([\s\S]*?isLocalForgeAppHost\(window\.location\.hostname\)[\s\S]*?hostname\.endsWith\('\.trycloudflare\.com'\)/.test(
    forgeRouteSource,
  ),
  'expected stale trycloudflare preview migration to be limited to local Forge hosts',
)

assert.ok(
  forgeRouteSource.includes('lastKnownPreviewUrlsByChatId') &&
    /freshSandboxPreviewUrl\s*\?\?\s*sandboxPreviewUrl\s*\?\?\s*lastKnownSandboxPreviewUrl/.test(
      forgeRouteSource,
    ),
  'expected Forge UI to keep a sticky per-chat preview URL when follow-up run snapshots omit preview events',
)
assert.ok(
  forgeRouteSource.includes('key={selectedChatId}') &&
    /currentPreviewUrl\s*!==\s*previewUrl[\s\S]*isLocalForgeQuickTunnelPreviewUrl\(currentPreviewUrl\)[\s\S]*\?\s*previewUrl[\s\S]*:\s*currentPreviewUrl/.test(
      forgeRouteSource,
    ),
  'expected the preview iframe src to stay immutable within a chat, except when migrating a stale local quick-tunnel URL',
)
assert.ok(
  forgeRouteSource.includes('existingSandboxPreviewUrl') &&
    forgeRouteSource.includes('previewUrl: existingSandboxPreviewUrl'),
  'expected Forge chat requests to carry the current live preview URL into follow-up runs',
)
assert.ok(
  forgeChatApiSource.includes('previewUrl?: string') &&
    forgeChatApiSource.includes('readForgePreviewUrlInput') &&
    forgeChatApiSource.includes('existingPreviewUrl: previewUrl'),
  'expected /api/forge/chat to parse the current preview URL and pass it to startLocalForgeAgentRun',
)
assert.ok(
  localAgentSource.includes('existingPreviewUrl?: string') &&
    /existingPreviewUrl\s*\?\?\s*readLatestForgeSandboxPreviewUrlFromSnapshot/.test(
      localAgentSource,
    ),
  'expected local Forge sandbox runs to prefer the UI-provided preview URL over run-centric snapshot events',
)

console.log('Forge sandbox worker routing verifier passed')
