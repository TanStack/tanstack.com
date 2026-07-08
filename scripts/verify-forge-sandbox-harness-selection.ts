import assert from 'node:assert/strict'
import {
  getLocalForgeHarness,
  hasForgeSandboxBinding,
  shouldUseForgeSandboxHarness,
} from '../src/builder/runtime/local-agent.server'
import { setHostRuntimeEnvOverrideForTest } from '../src/server/runtime/host.server'

// `local-agent.server.ts` must stay loadable under plain `tsx`: it imports
// `runForgeSandboxAgent` (and thus the Workers-runtime-only
// `@tanstack/ai-sandbox-cloudflare` chain) LAZILY inside the harness `run`,
// never at module top level. If that import had leaked to the top level, the
// `import` above would already have thrown here.
//
// The selection seam (`getLocalForgeHarness`) is driven for real: it awaits
// `getHostRuntimeEnv()`, which we drive with the test override, and it does
// NOT invoke the harness `run` (where the lazy CF import lives), so calling it
// stays tsx-safe. We assert on the resolved harness identity only.

// A fake Cloudflare `Sandbox` Durable Object namespace binding (DO-namespace
// shape: `idFromName` + `get`).
const fakeSandboxBinding = {
  get: () => ({}),
  idFromName: () => ({}),
}

// --- hasForgeSandboxBinding predicate ---------------------------------------
assert.equal(
  hasForgeSandboxBinding({ Sandbox: fakeSandboxBinding }),
  true,
  'a host env exposing a Sandbox DO namespace must be detected',
)
assert.equal(
  hasForgeSandboxBinding({}),
  false,
  'a host env with no Sandbox binding must not be detected',
)
assert.equal(
  hasForgeSandboxBinding(undefined),
  false,
  'an absent host env must not be detected as having a Sandbox binding',
)
assert.equal(
  hasForgeSandboxBinding({ Sandbox: 'not-a-binding' }),
  false,
  'a non-binding Sandbox value must not be detected',
)
assert.equal(
  shouldUseForgeSandboxHarness({ Sandbox: fakeSandboxBinding }),
  true,
  'local dev with a Sandbox binding must select the sandbox harness',
)
assert.equal(
  shouldUseForgeSandboxHarness({}),
  false,
  'a missing Sandbox binding must not select a fallback harness',
)

const byokCredential = {
  apiKey: 'sk-test-forge-byok',
  provider: 'openai' as const,
}

// --- tanstack-ai WITH a Sandbox binding selects the sandbox driver ----------
process.env.NODE_ENV = 'development'
setHostRuntimeEnvOverrideForTest({ Sandbox: fakeSandboxBinding })
try {
  const harness = await getLocalForgeHarness(byokCredential)
  assert.ok(harness, 'a harness must be selected with a Sandbox binding')
  assert.equal(harness.name, 'tanstack-ai')
  assert.equal(
    harness.label,
    'TanStack AI (Sandbox)',
    'a Sandbox binding must select the sandbox-driver harness',
  )
} finally {
  setHostRuntimeEnvOverrideForTest(undefined)
  delete process.env.NODE_ENV
}

// --- NO Sandbox binding fails closed instead of falling back ----------------
setHostRuntimeEnvOverrideForTest(undefined)
try {
  const harness = await getLocalForgeHarness(byokCredential)
  assert.equal(
    harness,
    null,
    'Forge must not fall back without a Sandbox binding',
  )
} finally {
  setHostRuntimeEnvOverrideForTest(undefined)
  delete process.env.NODE_ENV
}

console.log('Forge sandbox harness selection verifier passed')
