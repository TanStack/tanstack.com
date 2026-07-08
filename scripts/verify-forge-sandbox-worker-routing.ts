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
//    `proxyToSandbox(...)` runs and returns BEFORE the TanStack Start
//    fallthrough, that `Sandbox` is re-exported, and that `RunCoordinator`
//    is never referenced — is asserted statically against the `server.ts`
//    SOURCE text, ordering included.
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

// 1. `Sandbox` (the @cloudflare/sandbox container-host DO class) must be
//    re-exported so wrangler's `class_name: "Sandbox"` binding resolves.
assert.ok(
  /export\s*\{\s*Sandbox\s*\}\s*from\s*['"]@cloudflare\/sandbox['"]/.test(
    serverSource,
  ),
  "expected `export { Sandbox } from '@cloudflare/sandbox'` in src/server.ts",
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

// 4. `proxyToSandbox(...)` must be called, and its result returned, BEFORE
//    the Start handler fallthrough — checked within the exported Workers
//    entrypoint (`export default { async fetch(request, env) { ... } }`),
//    which is the actual fetch chain Workers invokes. (The inner
//    `createServerEntry(...)`/`wrapFetchWithSentry(...)` closure, assigned
//    to `server` above, textually precedes `export default` in the file but
//    is only reached once `export default`'s `fetch` falls through to
//    `server.fetch(...)` — so ordering is checked inside that block, not
//    across the whole file.)
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
  /return proxied/.test(proxyCallSlice.slice(0, 200)),
  'expected the proxyToSandbox(...) result to be returned (e.g. `if (proxied) return proxied`) shortly after the call',
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

console.log('Forge sandbox worker routing verifier passed')
