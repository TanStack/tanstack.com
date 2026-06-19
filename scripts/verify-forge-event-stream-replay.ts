import assert from 'node:assert/strict'
import {
  filterLocalForgeStateBatchAfterOffset,
  localForgeStateBatchNeedsSnapshot,
} from '../src/builder/runtime/local-store.server'
import type { BuilderStateEvent } from '../src/builder/schema'

const events = [
  createStateEvent({ stateOffset: 2, timelineOffset: 4 }),
  createStateEvent({ stateOffset: 3, timelineOffset: 5 }),
  createStateEvent({ stateOffset: 4, timelineOffset: 7 }),
]

assert.equal(
  filterLocalForgeStateBatchAfterOffset(
    {
      events,
      stateOffset: 4,
      timelineOffset: 7,
      type: 'state-batch',
    },
    4,
  ),
  undefined,
  'fully replayed buffered batches should not be emitted again',
)

assert.deepEqual(
  filterLocalForgeStateBatchAfterOffset(
    {
      events,
      stateOffset: 4,
      timelineOffset: 7,
      type: 'state-batch',
    },
    2,
  ),
  {
    events: [events[1], events[2]],
    stateOffset: 4,
    timelineOffset: 7,
    type: 'state-batch',
  },
  'partially replayed buffered batches should only emit later rows',
)

assert.equal(
  localForgeStateBatchNeedsSnapshot({
    events,
    stateOffset: 4,
    timelineOffset: 7,
    type: 'state-batch',
  }),
  false,
  'non-manifest batches should not force a full snapshot',
)

assert.equal(
  localForgeStateBatchNeedsSnapshot({
    events: [
      events[0],
      createStateEvent({
        stateOffset: 5,
        timelineOffset: 8,
        type: 'manifests',
      }),
    ],
    stateOffset: 5,
    timelineOffset: 8,
    type: 'state-batch',
  }),
  true,
  'manifest batches should force a fresh snapshot for file-content hydration',
)

console.log('Forge event stream replay verifier passed')

function createStateEvent({
  stateOffset,
  timelineOffset,
  type = 'messages',
}: {
  stateOffset: number
  timelineOffset: number
  type?: string
}): BuilderStateEvent {
  return {
    headers: {
      operation: 'insert',
      schemaVersion: 1,
      stateOffset: String(stateOffset),
      timelineEventId: `timeline-${timelineOffset}`,
      timelineOffset: String(timelineOffset),
      timestamp: '2026-06-18T00:00:00.000Z',
      txid: `state-${stateOffset}`,
    },
    key: `row-${stateOffset}`,
    type,
    value: {
      id: `row-${stateOffset}`,
    },
  }
}
