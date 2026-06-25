import assert from 'node:assert/strict'
import {
  isCodexCliForgeHarnessAllowed,
  resolveLocalForgeAgentHarnessName,
} from '../src/builder/runtime/local-agent.server'

assert.equal(resolveLocalForgeAgentHarnessName(undefined), 'codex-cli')
assert.equal(
  resolveLocalForgeAgentHarnessName(undefined, {
    isolateRuntime: false,
    nodeEnv: 'development',
  }),
  'codex-cli',
)
assert.equal(
  resolveLocalForgeAgentHarnessName('', {
    isolateRuntime: false,
    nodeEnv: 'development',
  }),
  'codex-cli',
)
assert.equal(
  resolveLocalForgeAgentHarnessName(undefined, {
    isolateRuntime: true,
    nodeEnv: 'development',
  }),
  'codex-cli',
)
assert.equal(
  resolveLocalForgeAgentHarnessName(undefined, {
    isolateRuntime: true,
    nodeEnv: 'production',
  }),
  'tanstack-ai',
)
assert.equal(resolveLocalForgeAgentHarnessName('tanstack-ai'), 'tanstack-ai')
assert.equal(resolveLocalForgeAgentHarnessName('codex'), 'codex-cli')
assert.equal(resolveLocalForgeAgentHarnessName('codex-cli'), 'codex-cli')
assert.equal(resolveLocalForgeAgentHarnessName('local-codex'), 'codex-cli')
assert.equal(
  resolveLocalForgeAgentHarnessName('cloudflare-workers-ai'),
  'cloudflare-workers-ai',
)
assert.equal(
  resolveLocalForgeAgentHarnessName('cloudflare-ai'),
  'cloudflare-workers-ai',
)
assert.equal(
  resolveLocalForgeAgentHarnessName('workers-ai'),
  'cloudflare-workers-ai',
)

assert.equal(
  isCodexCliForgeHarnessAllowed({
    nodeEnv: 'development',
  }),
  true,
)
assert.equal(
  isCodexCliForgeHarnessAllowed({
    nodeEnv: 'production',
  }),
  false,
)
assert.equal(
  isCodexCliForgeHarnessAllowed({
    enabled: 'true',
    nodeEnv: 'production',
  }),
  true,
)

console.log('Forge harness selection verifier passed')
