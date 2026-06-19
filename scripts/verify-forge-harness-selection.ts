import assert from 'node:assert/strict'
import {
  isCodexCliForgeHarnessAllowed,
  resolveLocalForgeAgentHarnessName,
} from '../src/builder/runtime/local-agent.server'

assert.equal(resolveLocalForgeAgentHarnessName(undefined), 'tanstack-ai')
assert.equal(resolveLocalForgeAgentHarnessName(''), 'tanstack-ai')
assert.equal(resolveLocalForgeAgentHarnessName('tanstack-ai'), 'tanstack-ai')
assert.equal(resolveLocalForgeAgentHarnessName('codex'), 'codex-cli')
assert.equal(resolveLocalForgeAgentHarnessName('codex-cli'), 'codex-cli')
assert.equal(resolveLocalForgeAgentHarnessName('local-codex'), 'codex-cli')

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
