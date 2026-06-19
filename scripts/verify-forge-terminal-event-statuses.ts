import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-terminal-status-'),
)

process.chdir(runtimeRoot)

try {
  const {
    appendLocalForgeRuntimeEvent,
    normalizeLocalForgeEventStatus,
    readLocalForgeSnapshot,
    readLocalForgeTimeline,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  assert.equal(
    normalizeLocalForgeEventStatus({
      name: 'agent.model.finished',
      status: 'running',
    }),
    'finished',
  )
  assert.equal(
    normalizeLocalForgeEventStatus({
      name: 'workflow.export.completed',
      status: 'running',
    }),
    'finished',
  )
  assert.equal(
    normalizeLocalForgeEventStatus({
      name: 'workflow.command.failed',
      status: 'running',
    }),
    'failed',
  )
  assert.equal(
    normalizeLocalForgeEventStatus({
      name: 'workflow.command.started',
      status: 'running',
    }),
    'running',
  )

  await appendLocalForgeRuntimeEvent({
    message: 'Typecheck passed',
    name: 'workflow.command.finished',
    producerId: 'terminal-status-fixture',
    runId: 'terminal-status-run',
    startedAt: Date.now(),
    status: 'running',
  })
  await appendLocalForgeRuntimeEvent({
    message: 'Build failed',
    name: 'workflow.command.failed',
    producerId: 'terminal-status-fixture',
    runId: 'terminal-status-run',
    startedAt: Date.now(),
    status: 'running',
  })

  const timeline = await readLocalForgeTimeline()
  const snapshot = await readLocalForgeSnapshot()
  const finishedTimelineEvent = timeline.find(
    (event) =>
      event.type === 'workflow.event.recorded' &&
      event.payload.name === 'workflow.command.finished',
  )
  const failedTimelineEvent = timeline.find(
    (event) =>
      event.type === 'workflow.event.recorded' &&
      event.payload.name === 'workflow.command.failed',
  )
  const finishedWorkflowRow = snapshot.workflowEvents.find(
    (event) => event.name === 'workflow.command.finished',
  )
  const failedWorkflowRow = snapshot.workflowEvents.find(
    (event) => event.name === 'workflow.command.failed',
  )

  assert.equal(finishedTimelineEvent?.payload.status, 'finished')
  assert.equal(failedTimelineEvent?.payload.status, 'failed')
  assert.equal(finishedWorkflowRow?.status, 'finished')
  assert.equal(failedWorkflowRow?.status, 'failed')
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge terminal event status verifier passed')
