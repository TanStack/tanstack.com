import assert from 'node:assert/strict'
import { resolveLocalForgeAgentHarnessName } from '../src/builder/runtime/local-agent.server'

assert.equal(resolveLocalForgeAgentHarnessName(undefined), 'codex')
assert.equal(resolveLocalForgeAgentHarnessName(''), 'codex')
assert.equal(resolveLocalForgeAgentHarnessName('codex'), 'codex')
assert.equal(resolveLocalForgeAgentHarnessName('CODEX'), 'codex')
assert.equal(resolveLocalForgeAgentHarnessName('claude-code'), 'claude-code')
assert.equal(resolveLocalForgeAgentHarnessName('claude'), 'claude-code')
assert.equal(resolveLocalForgeAgentHarnessName('something-else'), 'codex')

console.log('Forge harness selection verifier passed')
