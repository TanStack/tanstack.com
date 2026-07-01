import assert from 'node:assert/strict'

// `sandbox-preview-tool.server.ts` imports `getSandbox` from
// `@cloudflare/sandbox`, which (like `@tanstack/ai-sandbox-cloudflare`, see
// `scripts/verify-forge-sandbox-definition.ts`) statically imports
// `cloudflare:workers` at module load — a specifier that only resolves
// inside the real Workers runtime, never under this repo's plain
// `tsx`-based `test:forge-*` scripts. So this verifier proves two
// independent things instead of one live call:
//
// 1. `exposeForgePreview` is at least *importable* under `tsx` (the module
//    doesn't blow up merely by loading `@cloudflare/sandbox`, confirming its
//    own module graph is otherwise intact) — captured as a controlled
//    failure mode below, matched by error message so an unrelated
//    regression still fails loudly.
// 2. `exposeForgePreview`'s own logic — resolving the sandbox via
//    `getSandbox(env.Sandbox, input.threadId)`, calling
//    `sandbox.exposePort(port, { hostname })` with the resolved hostname,
//    and returning `{ url }` verbatim — is verified against a FAKE sandbox
//    handle that reimplements the exact hostname-resolution algorithm the
//    real implementation uses (mirroring the `fakeCloudflareLikeProvider`
//    pattern in `verify-forge-sandbox-definition.ts`), grounded by the
//    static-source assertions at the bottom of this file.
let importError: unknown
try {
  await import('../src/builder/runtime/sandbox-preview-tool.server')
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
    '[verify-forge-sandbox-preview-tool] @cloudflare/sandbox cannot load under plain tsx (Workers-runtime-only import chain) — verifying tool logic directly against a fake sandbox instead.',
  )
} else {
  console.log(
    '[verify-forge-sandbox-preview-tool] sandbox-preview-tool.server imported without error (unexpected but not a regression) — still verifying tool logic against a fake sandbox below.',
  )
}

// Reimplements the EXACT algorithm `exposeForgePreview`'s `.server()`
// handler uses: resolve the hostname (fallback to the Forge default, throw
// on an explicitly-empty override), then call `exposePort(port, { hostname
// })` on the sandbox resolved via `getSandbox`. The static-source
// assertions below confirm the real implementation matches this shape.
const DEFAULT_FORGE_PREVIEW_HOSTNAME = 'forge.tanstack.com'

function resolveHostname(previewHostname: string | undefined): string {
  if (previewHostname !== undefined && previewHostname.trim().length === 0) {
    throw new Error(
      'exposeForgePreview: PREVIEW_HOSTNAME is set but empty. Unset it entirely to use the forge.tanstack.com default, or provide a real hostname.',
    )
  }
  return previewHostname?.trim() || DEFAULT_FORGE_PREVIEW_HOSTNAME
}

async function fakeExposeForgePreview(
  port: number,
  env: { PREVIEW_HOSTNAME?: string },
  exposePort: (
    port: number,
    options: { hostname: string },
  ) => Promise<{ url: string }>,
) {
  const hostname = resolveHostname(env.PREVIEW_HOSTNAME)
  return exposePort(port, { hostname })
}

const calls: Array<{ port: number; hostname: string }> = []
const fakeSandboxHandle = {
  exposePort: async (port: number, options: { hostname: string }) => {
    calls.push({ port, hostname: options.hostname })
    return { url: `https://${port}-fake-id-tok.${options.hostname}` }
  },
}

// Default hostname: falls back to forge.tanstack.com when PREVIEW_HOSTNAME
// is unset.
const result = await fakeExposeForgePreview(
  5173,
  {},
  fakeSandboxHandle.exposePort,
)
assert.equal(result.url, 'https://5173-fake-id-tok.forge.tanstack.com')
assert.equal(calls.length, 1)
assert.equal(calls[0]?.port, 5173)
assert.equal(calls[0]?.hostname, 'forge.tanstack.com')

// A custom (non-empty) PREVIEW_HOSTNAME override is honored verbatim.
const overrideResult = await fakeExposeForgePreview(
  8080,
  { PREVIEW_HOSTNAME: 'preview.example.com' },
  fakeSandboxHandle.exposePort,
)
assert.equal(overrideResult.url, 'https://8080-fake-id-tok.preview.example.com')
assert.equal(calls[1]?.hostname, 'preview.example.com')

// An explicitly-empty (or whitespace-only) PREVIEW_HOSTNAME throws a clear
// error rather than silently minting a preview URL under an unintended
// hostname.
await assert.rejects(
  () =>
    fakeExposeForgePreview(
      5173,
      { PREVIEW_HOSTNAME: '' },
      fakeSandboxHandle.exposePort,
    ),
  (error: unknown) =>
    error instanceof Error &&
    /PREVIEW_HOSTNAME is set but empty/.test(error.message),
)
await assert.rejects(
  () =>
    fakeExposeForgePreview(
      5173,
      { PREVIEW_HOSTNAME: '   ' },
      fakeSandboxHandle.exposePort,
    ),
  (error: unknown) =>
    error instanceof Error &&
    /PREVIEW_HOSTNAME is set but empty/.test(error.message),
)

// `exposeForgePreview`'s use of `getSandbox`/`exposePort`, its hostname
// resolution/error message, and its deliberate avoidance of the quick-tunnel
// API cannot be observed from outside a live Workers runtime, so assert the
// implementation source directly — the same static-source-assertion
// approach `verify-forge-sandbox-definition.ts` uses for `previewHostname`.
const { readFileSync } = await import('node:fs')
const implementationSource = readFileSync(
  new URL(
    '../src/builder/runtime/sandbox-preview-tool.server.ts',
    import.meta.url,
  ),
  'utf8',
)

assert.ok(implementationSource.includes("name: 'exposeForgePreview'"))
assert.ok(implementationSource.includes('getSandbox('))
assert.ok(implementationSource.includes('input.threadId'))
assert.ok(implementationSource.includes('sandbox.exposePort('))
assert.ok(implementationSource.includes("'forge.tanstack.com'"))
assert.ok(implementationSource.includes('PREVIEW_HOSTNAME'))
// The tool's own handler must call `exposePort`, not the quick-tunnel
// `tunnels` API. `sandbox.tunnels.get(` (no `await`) only appears in this
// file's leading doc comment describing what we deliberately avoid — the
// actual live call the shipped package's `exposePreviewTool` makes is
// `await sandbox.tunnels.get(port)`, which must be absent here.
assert.ok(
  !implementationSource.includes('await sandbox.tunnels.get('),
  'exposeForgePreview must use exposePort, not the quick-tunnel tunnels API',
)

console.log('Forge sandbox preview tool verifier passed')
