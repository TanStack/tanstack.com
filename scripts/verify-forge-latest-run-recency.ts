import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { applyForgeStateEvents } from '../src/utils/forge-state'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'
import type { LocalForgeSnapshot } from '../src/builder/runtime/local-store.server'
import type { BuilderStateEvent } from '../src/builder/schema'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-latest-run-'))

process.chdir(runtimeRoot)

try {
  const {
    appendLocalForgeTimelineEvents,
    readLocalForgeSnapshot,
    readLocalForgeStateEvents,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()
  await appendLocalForgeTimelineEvents(createLateOldRunTimeline())

  const snapshot = await readLocalForgeSnapshot()

  assert.equal(
    snapshot.latestRun?.id,
    'new-run',
    'cold snapshots should select the most recently created run',
  )
  assert.equal(snapshot.latestRun?.status, 'running')
  assert.equal(snapshot.latestRun?.createdAt, '2026-06-18T00:00:10.000Z')

  const stateEvents = await readLocalForgeStateEvents()
  const reducedSession = applyForgeStateEvents(
    createEmptySnapshot(),
    stateEvents.map((event: BuilderStateEvent) => ({
      headers: {
        stateOffset: event.headers.stateOffset,
        timelineOffset: event.headers.timelineOffset,
      },
      key: event.key,
      type: event.type,
      value: event.value,
    })),
  )

  assert.equal(
    reducedSession.latestRun?.id,
    'new-run',
    'live reducer should not regress to a late older run update',
  )
  assert.equal(reducedSession.latestRun?.status, 'running')
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge latest run recency verifier passed')

function createLateOldRunTimeline() {
  return [
    runEvent({
      createdAt: '2026-06-18T00:00:00.000Z',
      eventId: 'old-run-queued',
      runId: 'old-run',
      seq: 1,
      type: 'run.queued',
    }),
    runEvent({
      createdAt: '2026-06-18T00:00:01.000Z',
      eventId: 'old-run-started',
      runId: 'old-run',
      seq: 2,
      type: 'run.started',
    }),
    runEvent({
      createdAt: '2026-06-18T00:00:10.000Z',
      eventId: 'new-run-queued',
      runId: 'new-run',
      seq: 3,
      type: 'run.queued',
    }),
    runEvent({
      createdAt: '2026-06-18T00:00:11.000Z',
      eventId: 'new-run-started',
      runId: 'new-run',
      seq: 4,
      type: 'run.started',
    }),
    {
      createdAt: '2026-06-18T00:00:12.000Z',
      eventId: 'old-run-late-failed',
      payload: {
        error: 'late old run failure',
        runId: 'old-run',
        status: 'failed',
      },
      producer: producer(5),
      projectId: 'latest-run-project',
      runId: 'old-run',
      schemaVersion: 1,
      sessionId: 'latest-run-session',
      type: 'run.failed',
    },
  ] satisfies Array<LocalBuilderTimelineEvent>
}

function runEvent({
  createdAt,
  eventId,
  runId,
  seq,
  type,
}: {
  createdAt: string
  eventId: string
  runId: string
  seq: number
  type: 'run.queued' | 'run.started'
}) {
  return {
    createdAt,
    eventId,
    payload: {
      inputEventId: `${runId}-input`,
      runId,
    },
    producer: producer(seq),
    projectId: 'latest-run-project',
    runId,
    schemaVersion: 1,
    sessionId: 'latest-run-session',
    type,
  } satisfies LocalBuilderTimelineEvent
}

function producer(seq: number) {
  return {
    epoch: 'latest-run-epoch',
    id: 'latest-run-fixture',
    kind: 'system',
    seq,
  } satisfies LocalBuilderTimelineEvent['producer']
}

function createEmptySnapshot(): LocalForgeSnapshot {
  const now = '2026-06-18T00:00:00.000Z'

  return {
    activeChatId: 'latest-run-session',
    agentEvents: [],
    chats: [
      {
        createdAt: now,
        id: 'latest-run-session',
        title: 'Latest run verifier',
        updatedAt: now,
      },
    ],
    exports: [],
    fileCount: 0,
    files: {},
    messages: [],
    stateEventCount: 0,
    timelineEventCount: 0,
    topFiles: [],
    totalBytes: 0,
    warnings: [],
    workflowEvents: [],
  }
}
