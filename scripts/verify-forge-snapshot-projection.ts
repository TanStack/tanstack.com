import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'
import type { BuilderStateEvent } from '../src/builder/schema'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-snapshot-'))

process.chdir(runtimeRoot)

try {
  const {
    appendLocalForgeTimelineEvents,
    createLocalForgeProducer,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    readLocalForgeSnapshot,
    readLocalForgeStateEvents,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  const createdAt = '2026-06-18T08:00:00.000Z'
  const runId = 'snapshot-run-fixture'
  const producerId = 'snapshot-projection-fixture'
  const events = [
    {
      createdAt,
      eventId: 'snapshot-agent-event',
      producer: createLocalForgeProducer({
        index: 0,
        kind: 'agent',
        producerId,
      }),
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId,
      schemaVersion: 1,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'agent.event.recorded',
      payload: {
        id: 'agent-row',
        message: 'Planning workspace changes',
        name: 'agent.tool.planRun',
        runId,
        status: 'running',
      },
    },
    {
      createdAt,
      eventId: 'snapshot-workflow-named-agent-event',
      producer: createLocalForgeProducer({
        index: 1,
        kind: 'agent',
        producerId,
      }),
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId,
      schemaVersion: 1,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'agent.event.recorded',
      payload: {
        id: 'workflow-named-agent-row',
        message: 'Running validation',
        name: 'workflow.command.started',
        runId,
        status: 'running',
      },
    },
    {
      createdAt,
      eventId: 'snapshot-workflow-event',
      producer: createLocalForgeProducer({
        index: 2,
        kind: 'system',
        producerId,
      }),
      projectId: LOCAL_FORGE_PROJECT_ID,
      runId,
      schemaVersion: 1,
      sessionId: LOCAL_FORGE_SESSION_ID,
      type: 'workflow.event.recorded',
      payload: {
        id: 'workflow-row',
        message: 'Typecheck passed',
        name: 'workflow.command.finished',
        runId,
        status: 'finished',
      },
    },
  ] satisfies Array<LocalBuilderTimelineEvent>

  await appendLocalForgeTimelineEvents(events)

  const stateEvents: Array<BuilderStateEvent> =
    await readLocalForgeStateEvents()
  const snapshot = await readLocalForgeSnapshot()

  assert.deepEqual(
    stateEvents.map((event) => event.type),
    ['agentEvents', 'agentEvents', 'workflowEvents'],
    'timeline events must be projected before snapshot hydration',
  )

  assert.deepEqual(
    snapshot.agentEvents.map((event) => event.id),
    ['agent-row'],
    'snapshot agent pane should exclude workflow-named agent rows',
  )
  assert.deepEqual(
    snapshot.workflowEvents.map((event) => event.id),
    ['workflow-named-agent-row', 'workflow-row'],
    'snapshot workflow pane should include workflow rows and workflow-named agent rows',
  )

  for (const event of stateEvents) {
    assert.ok(isRecord(event.value), 'projected event value must be an object')
    assert.equal(
      event.value.lastStateOffset,
      event.headers.stateOffset,
      'snapshot projection rows must preserve state-offset provenance',
    )
  }
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge snapshot projection verifier passed')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
