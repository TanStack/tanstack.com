import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-timeline-'))

process.chdir(runtimeRoot)

try {
  const {
    appendLocalForgeTimelineEvents,
    readLocalForgeTimeline,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  const firstEvent = createInputEvent({
    eventId: 'fixture-event-1',
    messageId: 'fixture-message-1',
    seq: 999,
    text: 'first',
  })
  const duplicateFirstEvent = createInputEvent({
    eventId: 'fixture-event-1',
    messageId: 'fixture-message-duplicate',
    seq: 999,
    text: 'duplicate',
  })
  const secondEvent = createInputEvent({
    eventId: 'fixture-event-2',
    messageId: 'fixture-message-2',
    seq: 999,
    text: 'second',
  })
  const duplicateSecondEvent = createInputEvent({
    eventId: 'fixture-event-2',
    messageId: 'fixture-message-2-duplicate',
    seq: 999,
    text: 'duplicate in same append batch',
  })

  await appendLocalForgeTimelineEvents([firstEvent])
  await appendLocalForgeTimelineEvents([
    duplicateFirstEvent,
    secondEvent,
    duplicateSecondEvent,
  ])

  const timeline = await readLocalForgeTimeline()

  assert.equal(timeline.length, 2)
  assert.deepEqual(
    timeline.map((event) => event.eventId),
    ['fixture-event-1', 'fixture-event-2'],
  )
  assert.deepEqual(
    timeline.map((event) => event.producer.seq),
    [1, 2],
  )

  const firstPersistedEvent = timeline[0]

  assert.equal(firstPersistedEvent.type, 'session.input.received')

  if (firstPersistedEvent.type === 'session.input.received') {
    assert.equal(firstPersistedEvent.payload.messageId, 'fixture-message-1')
    assert.equal(firstPersistedEvent.payload.text, 'first')
  }

  const secondPersistedEvent = timeline[1]

  assert.equal(secondPersistedEvent.type, 'session.input.received')

  if (secondPersistedEvent.type === 'session.input.received') {
    assert.equal(secondPersistedEvent.payload.messageId, 'fixture-message-2')
    assert.equal(secondPersistedEvent.payload.text, 'second')
  }
} finally {
  process.chdir(originalCwd)
}

console.log('Forge timeline append verifier passed')

function createInputEvent({
  eventId,
  messageId,
  seq,
  text,
}: {
  eventId: string
  messageId: string
  seq: number
  text: string
}): LocalBuilderTimelineEvent {
  return {
    createdAt: '2026-06-18T00:00:00.000Z',
    eventId,
    projectId: 'fixture-project',
    producer: {
      epoch: 'fixture-epoch',
      id: 'fixture-ui',
      kind: 'ui',
      seq,
    },
    schemaVersion: 1,
    sessionId: 'fixture-session',
    type: 'session.input.received',
    payload: {
      clientRequestId: `fixture-request-${messageId}`,
      messageId,
      text,
    },
  }
}
