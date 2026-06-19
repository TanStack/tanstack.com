import assert from 'node:assert/strict'
import { applyForgeStateEvents } from '../src/utils/forge-state'

type ForgeSessionForReducer = Parameters<typeof applyForgeStateEvents>[0]
type ForgeStateEventsForReducer = Parameters<typeof applyForgeStateEvents>[1]

const session = {
  agentEvents: [],
  exports: [],
  fileCount: 1,
  files: {
    'src/routes/index.tsx': 'old content',
  },
  framework: 'react',
  manifestVersionId: 'local-manifest-old',
  messages: [],
  packageManager: 'pnpm',
  stateEventCount: 4,
  timelineEventCount: 6,
  topFiles: ['src/routes/index.tsx'],
  totalBytes: 11,
  warnings: [],
  workflowEvents: [],
} satisfies ForgeSessionForReducer

const nextSession = applyForgeStateEvents(session, [
  {
    headers: {
      stateOffset: '5',
      timelineOffset: '7',
    },
    key: 'local-manifest-new',
    type: 'manifests',
    value: {
      fileCount: 2,
      id: 'local-manifest-new',
      totalBytes: 22,
    },
  },
] satisfies ForgeStateEventsForReducer)

assert.equal(nextSession.stateEventCount, 5)
assert.equal(nextSession.timelineEventCount, 7)
assert.equal(nextSession.manifestVersionId, session.manifestVersionId)
assert.equal(nextSession.fileCount, session.fileCount)
assert.equal(nextSession.totalBytes, session.totalBytes)
assert.deepEqual(nextSession.files, session.files)

console.log('Forge client manifest snapshot verifier passed')
