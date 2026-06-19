import assert from 'node:assert/strict'
import { projectLocalBuilderTimeline } from '../src/builder/projection'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'
import type { BuilderRunRow, BuilderStateEvent } from '../src/builder/schema'

const timeline = [
  {
    createdAt: '2026-06-18T00:00:00.000Z',
    eventId: 'terminal-run-queued',
    payload: {
      inputEventId: 'terminal-run-input',
      runId: 'terminal-run',
    },
    producer: producer(1),
    projectId: 'terminal-project',
    runId: 'terminal-run',
    schemaVersion: 1,
    sessionId: 'terminal-session',
    type: 'run.queued',
  },
  {
    createdAt: '2026-06-18T00:00:01.000Z',
    eventId: 'terminal-run-started',
    payload: {
      inputEventId: 'terminal-run-input',
      runId: 'terminal-run',
    },
    producer: producer(2),
    projectId: 'terminal-project',
    runId: 'terminal-run',
    schemaVersion: 1,
    sessionId: 'terminal-session',
    type: 'run.started',
  },
  {
    createdAt: '2026-06-18T00:00:02.000Z',
    eventId: 'terminal-run-finished',
    payload: {
      runId: 'terminal-run',
      status: 'finished',
    },
    producer: producer(3),
    projectId: 'terminal-project',
    runId: 'terminal-run',
    schemaVersion: 1,
    sessionId: 'terminal-session',
    type: 'run.finished',
  },
  {
    createdAt: '2026-06-18T00:00:03.000Z',
    eventId: 'terminal-run-late-failed',
    payload: {
      error: 'late failure evidence',
      runId: 'terminal-run',
      status: 'failed',
    },
    producer: producer(4),
    projectId: 'terminal-project',
    runId: 'terminal-run',
    schemaVersion: 1,
    sessionId: 'terminal-session',
    type: 'run.failed',
  },
  {
    createdAt: '2026-06-18T00:00:04.000Z',
    eventId: 'terminal-run-late-started',
    payload: {
      inputEventId: 'terminal-run-input',
      runId: 'terminal-run',
    },
    producer: producer(5),
    projectId: 'terminal-project',
    runId: 'terminal-run',
    schemaVersion: 1,
    sessionId: 'terminal-session',
    type: 'run.started',
  },
] satisfies Array<LocalBuilderTimelineEvent>

const stateEvents = projectLocalBuilderTimeline(timeline)
const runStateEvents = stateEvents.filter(isRunStateEvent)
const finalRunEvent = runStateEvents.at(-1)

assert.deepEqual(
  runStateEvents.map((event) => event.headers.timelineEventId),
  ['terminal-run-queued', 'terminal-run-started', 'terminal-run-finished'],
)
assert.equal(finalRunEvent?.value?.status, 'finished')
assert.equal(finalRunEvent?.value?.endedAt, '2026-06-18T00:00:02.000Z')
assert.equal(finalRunEvent?.value?.error, undefined)
assert.equal(
  stateEvents.some(
    (event) => event.headers.timelineEventId === 'terminal-run-late-failed',
  ),
  false,
)
assert.equal(
  stateEvents.some(
    (event) => event.headers.timelineEventId === 'terminal-run-late-started',
  ),
  false,
)

console.log('Forge terminal run projection verifier passed')

function isRunStateEvent(
  event: BuilderStateEvent,
): event is BuilderStateEvent<BuilderRunRow> {
  return event.type === 'runs' && event.value !== undefined
}

function producer(seq: number) {
  return {
    epoch: 'terminal-projection-epoch',
    id: 'terminal-projection-fixture',
    kind: 'system',
    seq,
  } satisfies LocalBuilderTimelineEvent['producer']
}
