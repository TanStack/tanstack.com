import assert from 'node:assert/strict'
import test from 'node:test'
import { drizzle } from 'drizzle-orm/pg-proxy'
import * as schema from '../src/db/schema'
import {
  assertBuilderProjectEventPayload,
  builderProjectEventPayloadMaxBytes,
  getBuilderProjectEventPayloadBytes,
  parseBuilderProjectEvent,
} from '../src/utils/builder-project-events'
import {
  builderProjectNonterminalRunStatuses,
  getDeletedBuilderProjectRunState,
  getBuilderProjectMutationRequestHash,
  getNextBuilderProjectPendingRunQuery,
  isMatchingBuilderProjectCreationReplay,
  isMatchingBuilderProjectMutationReceipt,
  type BuilderProjectCreationReplayRecord,
  type CreateBuilderProjectStateInput,
} from '../src/utils/builder-project-events.server'

const event = {
  version: 1,
  id: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  ownerId: '33333333-3333-4333-8333-333333333333',
  threadId: '44444444-4444-4444-8444-444444444444',
  revisionId: null,
  messageId: '55555555-5555-4555-8555-555555555555',
  runId: '66666666-6666-4666-8666-666666666666',
  sequence: 7,
  clientEventId: '77777777-7777-4777-8777-777777777777',
  clientMutationId: '88888888-8888-4888-8888-888888888888',
  browserSessionId: '99999999-9999-4999-8999-999999999999',
  type: 'message.created',
  payload: {
    message: {
      id: '55555555-5555-4555-8555-555555555555',
      content: 'Build it',
    },
  },
  occurredAt: '2026-08-20T12:00:00.000Z',
  createdAt: '2026-08-20T12:00:01.000Z',
}

test('parses a strict durable Builder project event', () => {
  assert.deepEqual(parseBuilderProjectEvent(event), event)
  assert.throws(() => parseBuilderProjectEvent({ ...event, extra: true }))
  assert.throws(() =>
    parseBuilderProjectEvent({
      ...event,
      sequence: Number.MAX_SAFE_INTEGER + 1,
    }),
  )
})

test('requires an entity reference for typed entity events', () => {
  assert.throws(() => parseBuilderProjectEvent({ ...event, messageId: null }))
  assert.throws(() =>
    parseBuilderProjectEvent({
      ...event,
      type: 'thread.created',
      threadId: null,
      messageId: null,
      runId: null,
    }),
  )
})

test('rejects non-JSON and oversized event payloads', () => {
  assert.throws(() => assertBuilderProjectEventPayload({ value: Infinity }))
  assert.throws(() => assertBuilderProjectEventPayload([]))

  const payload = { content: 'x'.repeat(builderProjectEventPayloadMaxBytes) }
  assert.ok(
    getBuilderProjectEventPayloadBytes(payload) >
      builderProjectEventPayloadMaxBytes,
  )
  assert.throws(() => assertBuilderProjectEventPayload(payload))
})

test('project deletion produces a terminal cancelled run state', () => {
  const occurredAt = new Date('2026-08-20T12:00:00.000Z')

  assert.deepEqual(getDeletedBuilderProjectRunState(occurredAt), {
    status: 'cancelled',
    leaseOwnerId: null,
    leaseExpiresAt: null,
    completedAt: occurredAt,
    updatedAt: occurredAt,
  })
  assert.deepEqual(builderProjectNonterminalRunStatuses, ['pending', 'running'])
})

test('the authoritative queue claims steer runs before older queued runs', () => {
  const database = drizzle(async () => ({ rows: [] }), { schema })
  const query = getNextBuilderProjectPendingRunQuery({
    projectId: event.projectId,
    database,
  }).toSQL()
  const orderBy = query.sql.slice(query.sql.indexOf('order by'))

  assert.match(
    orderBy,
    /case when .*queue_kind.*'steer' then 0 else 1 end.*created_at.*\."id".*limit.*for update/i,
  )
})

test('project creation replays require the original ID and payload', () => {
  const createdAt = new Date('2026-08-20T12:00:00.000Z')
  const input: CreateBuilderProjectStateInput = {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: '22222222-2222-4222-8222-222222222222',
    clientMutationId: '33333333-3333-4333-8333-333333333333',
    revisionId: '44444444-4444-4444-8444-444444444444',
    snapshotHash: 'a'.repeat(64),
    title: 'Original project',
    description: 'Original description',
    forkedFromId: '55555555-5555-4555-8555-555555555555',
    createdAt,
    updatedAt: createdAt,
  }
  const record: BuilderProjectCreationReplayRecord = {
    project: {
      id: input.id,
      ownerId: input.ownerId,
      clientMutationId: input.clientMutationId,
      forkedFromId: input.forkedFromId ?? null,
      createdAt,
    },
    revision: {
      id: input.revisionId,
      projectId: input.id,
      ownerId: input.ownerId,
      clientMutationId: input.clientMutationId,
      parentRevisionId: null,
      revisionNumber: 1,
      snapshotHash: input.snapshotHash,
      createdAt,
    },
    eventPayload: {
      project: {
        id: input.id,
        ownerId: input.ownerId,
        forkedFromId: input.forkedFromId ?? null,
        title: input.title,
        description: input.description,
        snapshotHash: input.snapshotHash,
        currentRevisionId: input.revisionId,
        currentRevisionNumber: 1,
        lastEventSequence: 0,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      },
    },
  }

  assert.equal(isMatchingBuilderProjectCreationReplay(input, record), true)
  assert.equal(
    isMatchingBuilderProjectCreationReplay(
      { ...input, id: '66666666-6666-4666-8666-666666666666' },
      record,
    ),
    false,
  )
  assert.equal(
    isMatchingBuilderProjectCreationReplay(
      { ...input, snapshotHash: 'b'.repeat(64) },
      record,
    ),
    false,
  )
  assert.equal(
    isMatchingBuilderProjectCreationReplay(
      { ...input, title: 'Changed retry' },
      record,
    ),
    false,
  )
  assert.equal(
    isMatchingBuilderProjectCreationReplay(
      {
        ...input,
        revisionId: '77777777-7777-4777-8777-777777777777',
      },
      record,
      false,
    ),
    true,
  )
})

test('mutation receipts bind a replay to its canonical command payload', async () => {
  const original = {
    type: 'run.enqueue',
    clientMutationId: '11111111-1111-4111-8111-111111111111',
    run: {
      id: '22222222-2222-4222-8222-222222222222',
      model: 'gpt-5.6-luna',
      provider: 'openai',
    },
  }
  const originalHash = await getBuilderProjectMutationRequestHash(original)
  const reorderedHash = await getBuilderProjectMutationRequestHash({
    run: {
      provider: 'openai',
      model: 'gpt-5.6-luna',
      id: '22222222-2222-4222-8222-222222222222',
    },
    clientMutationId: '11111111-1111-4111-8111-111111111111',
    type: 'run.enqueue',
  })
  const changedHash = await getBuilderProjectMutationRequestHash({
    ...original,
    run: { ...original.run, model: 'gpt-5.6' },
  })

  assert.equal(reorderedHash, originalHash)
  assert.notEqual(changedHash, originalHash)
  assert.equal(
    isMatchingBuilderProjectMutationReceipt(
      { commandType: 'run.enqueue', requestHash: originalHash },
      { commandType: 'run.enqueue', requestHash: reorderedHash },
    ),
    true,
  )
  assert.equal(
    isMatchingBuilderProjectMutationReceipt(
      { commandType: 'run.enqueue', requestHash: changedHash },
      { commandType: 'run.enqueue', requestHash: originalHash },
    ),
    false,
  )
  assert.equal(
    isMatchingBuilderProjectMutationReceipt(
      { commandType: 'run.finish', requestHash: originalHash },
      { commandType: 'run.enqueue', requestHash: originalHash },
    ),
    false,
  )
})
