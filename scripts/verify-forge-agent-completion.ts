import assert from 'node:assert/strict'
import { getLocalForgeAgentCompletionProblems } from '../src/builder/runtime/local-agent.server'

assert.deepEqual(
  getLocalForgeAgentCompletionProblems({
    changeCount: 1,
    planReceived: true,
    summaryReceived: true,
    validated: true,
    validatedChangeCount: 1,
    validatedWithWorkspaceCommands: true,
    validationProblems: [],
  }),
  [],
  'complete agent state should have no completion problems',
)

assert.deepEqual(
  getLocalForgeAgentCompletionProblems({
    changeCount: 1,
    planReceived: true,
    summaryReceived: false,
    validated: true,
    validatedChangeCount: 1,
    validatedWithWorkspaceCommands: true,
    validationProblems: [],
  }),
  ['agent did not call setSummary'],
  'runs must not finish with a generic fallback assistant summary',
)

assert.deepEqual(
  getLocalForgeAgentCompletionProblems({
    changeCount: 0,
    planReceived: false,
    summaryReceived: false,
    validated: false,
    validatedChangeCount: undefined,
    validatedWithWorkspaceCommands: false,
    validationProblems: ['src/routes/index.tsx is required'],
  }),
  [
    'agent did not call planRun',
    'agent did not change any files',
    'agent did not call validateFiles',
    'agent did not call setSummary',
    'src/routes/index.tsx is required',
  ],
  'completion gate should report every missing required agent step',
)

assert.deepEqual(
  getLocalForgeAgentCompletionProblems({
    changeCount: 2,
    planReceived: true,
    summaryReceived: true,
    validated: true,
    validatedChangeCount: 1,
    validatedWithWorkspaceCommands: true,
    validationProblems: [],
  }),
  ['agent changed files after validateFiles'],
  'runs must validate after the final source edit',
)

assert.deepEqual(
  getLocalForgeAgentCompletionProblems({
    changeCount: 1,
    planReceived: true,
    summaryReceived: true,
    validated: true,
    validatedChangeCount: 1,
    validatedWithWorkspaceCommands: false,
    validationProblems: [],
  }),
  ['agent did not run workspace command validation'],
  'runs must validate route generation and TypeScript, not only syntax',
)

console.log('Forge agent completion verifier passed')
