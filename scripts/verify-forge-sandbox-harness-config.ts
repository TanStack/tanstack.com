import assert from 'node:assert/strict'

// `sandbox-agent.server.ts` imports `cloudflareSandbox` from
// `@tanstack/ai-sandbox-cloudflare` (via `buildForgeSandbox`, already
// verified in `verify-forge-sandbox-definition.ts`) which, like
// `@cloudflare/sandbox` in `verify-forge-sandbox-preview-tool.ts`,
// statically imports `cloudflare:workers` at module load — a specifier
// that only resolves inside the real Workers runtime, never under this
// repo's plain `tsx`-based `test:forge-*` scripts. So this verifier proves
// two independent things instead of one live call:
//
// 1. The module (now also exporting `runForgeSandboxAgent`) is at least
//    *importable* under `tsx` (doesn't blow up merely by loading
//    `@tanstack/ai-sandbox-cloudflare`) — captured as a controlled failure
//    mode below, matched by error message so an unrelated regression still
//    fails loudly.
// 2. `runForgeSandboxAgent`'s wiring — the Codex model/sandbox-mode
//    selection, the `withSandbox` middleware, the `exposeForgePreview` tool,
//    and the raw (untranslated) `onChunk` forwarding — is verified directly
//    against the implementation SOURCE, mirroring the static-source-assertion
//    approach `verify-forge-sandbox-definition.ts` and
//    `verify-forge-sandbox-preview-tool.ts` already use for the pieces that
//    are genuinely unobservable without a live Workers runtime + real sandbox.
let importError: unknown
let liveRunForgeSandboxAgent:
  | typeof import('../src/builder/runtime/sandbox-agent.server').runForgeSandboxAgent
  | undefined
try {
  ;({ runForgeSandboxAgent: liveRunForgeSandboxAgent } =
    await import('../src/builder/runtime/sandbox-agent.server'))
} catch (error) {
  importError = error
}

if (importError) {
  assert.ok(
    importError instanceof Error &&
      /cloudflare:|@cloudflare\/containers/.test(importError.message),
    `expected the only possible import failure to be the known Workers-runtime-only gap, got: ${String(importError)}`,
  )
  console.log(
    '[verify-forge-sandbox-harness-config] @tanstack/ai-sandbox-cloudflare cannot load under plain tsx (Workers-runtime-only import chain) — verifying runForgeSandboxAgent wiring directly against the implementation source instead.',
  )
} else {
  assert.equal(typeof liveRunForgeSandboxAgent, 'function')
  console.log(
    '[verify-forge-sandbox-harness-config] sandbox-agent.server imported without error (unexpected but not a regression) — still verifying wiring against the implementation source below.',
  )
}

// The per-provider adapters (`codexText`/`claudeCodeText`), `withSandbox`,
// `exposeForgePreview`, and the raw-chunk forwarding cannot be exercised
// end-to-end without a live sandbox + Workers runtime (a real coding-agent run
// streaming real StreamChunks), so assert the implementation source directly.
const { readFileSync } = await import('node:fs')
const implementationSource = readFileSync(
  new URL('../src/builder/runtime/sandbox-agent.server.ts', import.meta.url),
  'utf8',
)

assert.ok(
  implementationSource.includes('export async function runForgeSandboxAgent'),
  'expected runForgeSandboxAgent to be exported from sandbox-agent.server.ts',
)
// OpenAI keys drive the Codex CLI; Anthropic keys drive the Claude Code CLI.
assert.ok(
  implementationSource.includes('codexText(FORGE_SANDBOX_OPENAI_MODEL'),
  'expected the OpenAI branch to drive codexText',
)
assert.ok(
  implementationSource.includes("FORGE_SANDBOX_OPENAI_MODEL = 'gpt-5.3-codex'"),
  'expected the Codex model to be gpt-5.3-codex',
)
assert.ok(
  implementationSource.includes("sandboxMode: 'danger-full-access'"),
  'expected the Codex branch to configure danger-full-access sandbox mode',
)
assert.ok(
  implementationSource.includes('claudeCodeText(FORGE_SANDBOX_ANTHROPIC_MODEL'),
  'expected the Anthropic branch to drive claudeCodeText',
)
assert.ok(
  implementationSource.includes("permissionMode: 'bypassPermissions'"),
  'expected the Claude Code branch to configure bypassPermissions mode',
)
assert.ok(
  implementationSource.includes("anthropic: 'ANTHROPIC_API_KEY'") &&
    implementationSource.includes("openai: 'CODEX_API_KEY'"),
  'expected each provider key to inject under its own sandbox env var',
)
assert.ok(
  implementationSource.includes('withSandbox('),
  'expected runForgeSandboxAgent to wire the withSandbox middleware',
)
assert.ok(
  implementationSource.includes('exposeForgePreview('),
  'expected runForgeSandboxAgent to expose the exposeForgePreview tool',
)
assert.ok(
  implementationSource.includes('forgePersistenceHooks('),
  'expected runForgeSandboxAgent to wire R2 persistence hooks via forgePersistenceHooks',
)
assert.ok(
  implementationSource.includes('manifestVersionId ?? projectId'),
  'expected runForgeSandboxAgent to key forgePersistenceHooks by manifestVersionId, falling back to projectId',
)

// `onChunk` must forward RAW chunks unchanged — no `translateChunk(...)` CALL
// anywhere in this module (a doc comment may still reference the name to
// explain that a later task's SSE-proxy consumer owns translation).
assert.ok(
  !implementationSource.includes('translateChunk('),
  'runForgeSandboxAgent must forward raw StreamChunks — translateChunk(...) must not be called in sandbox-agent.server.ts',
)
assert.ok(
  /for await \(const chunk of stream\) \{\s*onChunk\(chunk\)/.test(
    implementationSource,
  ),
  'expected runForgeSandboxAgent to forward each raw stream chunk verbatim to onChunk',
)

console.log('Forge sandbox harness config verifier passed')
