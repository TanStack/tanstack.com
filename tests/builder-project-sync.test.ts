import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compactBuilderAiActivityForDurableSync,
  reduceBuilderAiActivity,
} from '../src/utils/builder-ai-activity'
import { getBuilderProjectEventPayloadBytes } from '../src/utils/builder-project-events'
import {
  builderProjectSyncSnapshotContinuationMaxCharacters,
  builderProjectSyncSnapshotPageMaxRows,
  builderProjectSyncSnapshotPageMaxBytes,
  encodeBuilderProjectSyncSnapshotContinuation,
  getBuilderProjectSyncSnapshotPageBytes,
  isBuilderProjectSyncCommandRejection,
  parseBuilderProjectSyncRequest,
  parseBuilderProjectSyncResponse,
  parseBuilderProjectSyncSnapshot,
  parseBuilderProjectSyncSnapshotContinuation,
  parseBuilderProjectSyncSnapshotPage,
  takeBuilderProjectSyncSnapshotPageRows,
  type BuilderProjectSyncEvent,
  type BuilderProjectSyncSnapshotContinuation,
} from '../src/utils/builder-project-sync'
import {
  createBuilderProjectEventStreamResponse,
  encodeBuilderProjectSyncEvent,
  isBuilderProjectSyncStreamRequest,
  parseBuilderProjectSyncCursor,
} from '../src/utils/builder-project-sync-http.server'
import { createSharedExampleProject } from '../src/utils/example-project'
import { createExampleWorkspace } from '../src/utils/example-workspace'

const projectId = '11111111-1111-4111-8111-111111111111'
const threadId = '22222222-2222-4222-8222-222222222222'
const runId = '33333333-3333-4333-8333-333333333333'
const messageId = '44444444-4444-4444-8444-444444444444'
const mutationId = '55555555-5555-4555-8555-555555555555'
const messageMutationId = '66666666-6666-4666-8666-666666666666'
const leaseOwnerId = '77777777-7777-4777-8777-777777777777'
const eventId = '88888888-8888-4888-8888-888888888888'
const runMutationId = '99999999-9999-4999-8999-999999999999'
const heartbeatMutationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const finishMutationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const timestamp = '2026-08-20T16:00:00.000Z'

test('parses canonical durable project revisions', () => {
  const project = createSharedExampleProject({
    title: 'Durable edit',
    description: 'Queued before upload.',
    initialFile: '/index.tsx',
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: { '/index.tsx': 'export default 42' },
    }),
  })
  const [command] = parseBuilderProjectSyncRequest({
    commands: [
      {
        type: 'project.revise',
        clientMutationId: mutationId,
        revisionId: eventId,
        expectedRevisionNumber: 1,
        project,
      },
    ],
  }).commands

  assert.deepEqual(command, {
    type: 'project.revise',
    clientMutationId: mutationId,
    revisionId: eventId,
    expectedRevisionNumber: 1,
    project,
  })
  assert.throws(() =>
    parseBuilderProjectSyncRequest({
      commands: [
        {
          type: 'project.revise',
          clientMutationId: mutationId,
          revisionId: eventId,
          expectedRevisionNumber: 1,
          project: { ...project, extra: true },
        },
      ],
    }),
  )
})

test('rejects unsendable project revisions before they enter the outbox', () => {
  const project = createSharedExampleProject({
    title: 'Oversized edit',
    initialFile: '/index.tsx',
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: { '/index.tsx': 'a'.repeat(512 * 1024 + 1) },
    }),
  })

  assert.throws(() =>
    parseBuilderProjectSyncRequest({
      commands: [
        {
          type: 'project.revise',
          clientMutationId: mutationId,
          revisionId: eventId,
          expectedRevisionNumber: 1,
          project,
        },
      ],
    }),
  )
})

test('strictly parses Builder project sync commands', () => {
  const request = parseBuilderProjectSyncRequest({
    commands: [
      {
        type: 'thread.create',
        clientMutationId: mutationId,
        thread: { id: threadId, title: 'First thread' },
      },
      {
        type: 'run.enqueue',
        clientMutationId: runMutationId,
        run: {
          id: runId,
          threadId,
          queueKind: 'queue',
          provider: 'openai',
          model: 'gpt-5.6-luna',
        },
        userMessage: {
          id: messageId,
          clientMutationId: messageMutationId,
          content: 'Build a chart',
          parts: [{ type: 'text', content: 'Build a chart' }],
        },
      },
      {
        type: 'run.claim',
        clientMutationId: eventId,
        runId,
        leaseOwnerId,
      },
      {
        type: 'run.heartbeat',
        clientMutationId: heartbeatMutationId,
        runId,
        leaseOwnerId,
        leaseFencingToken: 1,
      },
      {
        type: 'run.finish',
        clientMutationId: finishMutationId,
        runId,
        leaseOwnerId,
        leaseFencingToken: 1,
        status: 'completed',
        revision: {
          id: eventId,
          clientMutationId: heartbeatMutationId,
          snapshotHash: 'a'.repeat(64),
          title: 'Chart',
          description: '',
          expectedRevisionNumber: 1,
        },
        assistantMessage: {
          id: messageId,
          clientMutationId: messageMutationId,
          runId,
          content: 'Done',
          parts: [{ type: 'text', content: 'Done' }],
        },
      },
    ],
  })

  assert.equal(request.commands.length, 5)
  assert.equal(request.commands[1]?.type, 'run.enqueue')
  assert.equal(request.commands[2]?.type, 'run.claim')
})

test('rejects invalid terminal runs and transcript references', () => {
  assert.throws(() =>
    parseBuilderProjectSyncRequest({
      commands: [
        {
          type: 'run.finish',
          clientMutationId: mutationId,
          runId,
          leaseOwnerId,
          leaseFencingToken: 1,
          status: 'completed',
        },
      ],
    }),
  )

  assert.throws(() =>
    parseBuilderProjectSyncRequest({
      commands: [
        {
          type: 'transcript.import',
          clientMutationId: mutationId,
          threads: [],
          messages: [
            {
              id: messageId,
              threadId,
              role: 'user',
              content: 'Orphaned',
              parts: [{ type: 'text', content: 'Orphaned' }],
              position: 1,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        },
      ],
    }),
  )
})

test('rejects a transcript message linked to a run in another thread', () => {
  assert.throws(() =>
    parseBuilderProjectSyncRequest({
      commands: [
        {
          type: 'transcript.import',
          clientMutationId: mutationId,
          threads: [
            {
              id: threadId,
              title: 'First thread',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            {
              id: eventId,
              title: 'Second thread',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
          messages: [
            {
              id: messageId,
              threadId,
              runId,
              role: 'assistant',
              content: 'Wrong thread',
              parts: [{ type: 'text', content: 'Wrong thread' }],
              position: 1,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
          runs: [
            {
              id: runId,
              threadId: eventId,
              queueKind: 'queue',
              status: 'completed',
              provider: 'openai',
              model: 'gpt-5.6-luna',
              completedAt: timestamp,
            },
          ],
        },
      ],
    }),
  )
})

test('rejects transcript imports above the conservative request budget', () => {
  assert.throws(
    () =>
      parseBuilderProjectSyncRequest({
        commands: [
          {
            type: 'transcript.import',
            clientMutationId: mutationId,
            threads: [
              {
                id: threadId,
                title: 'Large transcript',
                createdAt: timestamp,
                updatedAt: timestamp,
              },
            ],
            messages: Array.from({ length: 9 }, (_, index) => ({
              id: transcriptMessageId(index),
              threadId,
              role: 'user',
              content: 'x'.repeat(190_000),
              parts: [],
              position: index + 1,
              createdAt: timestamp,
              updatedAt: timestamp,
            })),
            runs: [],
          },
        ],
      }),
    /Transcript import command is too large/,
  )
})

test('bounds event payload bytes and validates terminal activity', () => {
  const revision = {
    id: eventId,
    clientMutationId: heartbeatMutationId,
    snapshotHash: 'a'.repeat(64),
    title: 'Chart',
    description: '',
    expectedRevisionNumber: 1,
  }
  const assistantMessage = {
    id: messageId,
    clientMutationId: messageMutationId,
    runId,
    content: 'Done',
    parts: [{ type: 'text', content: 'Done' }],
  }

  assert.throws(() =>
    parseBuilderProjectSyncRequest({
      commands: [
        {
          type: 'run.finish',
          clientMutationId: finishMutationId,
          runId,
          leaseOwnerId,
          leaseFencingToken: 1,
          status: 'completed',
          revision,
          assistantMessage: {
            ...assistantMessage,
            content: '🚀'.repeat(60_000),
          },
        },
      ],
    }),
  )

  assert.throws(() =>
    parseBuilderProjectSyncRequest({
      commands: [
        {
          type: 'run.finish',
          clientMutationId: finishMutationId,
          runId,
          leaseOwnerId,
          leaseFencingToken: 1,
          status: 'completed',
          revision,
          assistantMessage,
          activity: {
            id: runId,
            status: 'error',
            startedAt: 1,
            completedAt: 2,
            items: [],
            error: 'Failed',
          },
        },
      ],
    }),
  )

  const fullActivity = createOversizedFailedActivity()
  assert.throws(
    () =>
      parseBuilderProjectSyncRequest({
        commands: [
          {
            type: 'run.finish',
            clientMutationId: finishMutationId,
            runId,
            leaseOwnerId,
            leaseFencingToken: 1,
            status: 'failed',
            error: { message: fullActivity.error ?? 'Failed' },
            activity: fullActivity,
          },
        ],
      }),
    /Run details are too large/,
  )

  const durableActivity = compactBuilderAiActivityForDurableSync(fullActivity)
  const request = parseBuilderProjectSyncRequest({
    commands: [
      {
        type: 'run.finish',
        clientMutationId: finishMutationId,
        runId,
        leaseOwnerId,
        leaseFencingToken: 1,
        status: 'failed',
        error: { message: durableActivity.error ?? 'Failed' },
        activity: durableActivity,
      },
    ],
  })
  const command = request.commands[0]
  assert.equal(command?.type, 'run.finish')
  if (command?.type !== 'run.finish') throw new Error('Expected run.finish')
  assert.ok(
    getBuilderProjectEventPayloadBytes({
      activity: command.activity ?? null,
      error: command.error ?? null,
    }) <=
      160 * 1024,
  )
})

test('accepts completed no-change runs without a revision', () => {
  const request = parseBuilderProjectSyncRequest({
    commands: [
      {
        type: 'run.finish',
        clientMutationId: finishMutationId,
        runId,
        leaseOwnerId,
        leaseFencingToken: 1,
        status: 'completed',
        assistantMessage: {
          id: messageId,
          clientMutationId: messageMutationId,
          runId,
          content: 'No code changes were needed.',
          parts: [{ type: 'text', content: 'No code changes were needed.' }],
        },
      },
    ],
  })

  assert.equal(request.commands[0]?.type, 'run.finish')
})

test('parses an explicit terminal command rejection without treating it as a commit', () => {
  const response = parseBuilderProjectSyncResponse({
    cursor: 8,
    results: [
      {
        clientMutationId: finishMutationId,
        rejected: true,
        code: 'run-lease-invalid',
        message: 'Builder project run lease is no longer valid',
      },
    ],
  })
  const [outcome] = response.results

  assert.ok(outcome && isBuilderProjectSyncCommandRejection(outcome))
  assert.equal(outcome.clientMutationId, finishMutationId)
  assert.equal('sequence' in outcome, false)
  assert.throws(() =>
    parseBuilderProjectSyncResponse({
      cursor: 8,
      results: [
        {
          clientMutationId: finishMutationId,
          rejected: true,
          code: 'unknown-rejection',
          message: 'Unknown',
        },
      ],
    }),
  )
})

test('parses a revision conflict fallback sequence', () => {
  const response = parseBuilderProjectSyncResponse({
    cursor: 9,
    results: [
      {
        clientMutationId: finishMutationId,
        rejected: true,
        code: 'project-revision-conflict',
        message: 'Builder project revision changed',
        sequence: 9,
      },
    ],
  })
  const [outcome] = response.results

  assert.ok(outcome && isBuilderProjectSyncCommandRejection(outcome))
  assert.equal(outcome.sequence, 9)
})

function createOversizedFailedActivity() {
  let activity = reduceBuilderAiActivity(undefined, {
    type: 'run-started',
    runId,
    timestamp: 1_000,
  })
  for (let index = 0; index < 10; index++) {
    activity = reduceBuilderAiActivity(activity, {
      type: 'item-completed',
      runId,
      itemId: `apply-${index}`,
      source: 'harness',
      name: 'apply_workspace',
      timestamp: 1_100 + index,
      output: {
        paths: Array.from(
          { length: 100 },
          (_, pathIndex) =>
            `/generated/${index}/${pathIndex}-${'路'.repeat(600)}.tsx`,
        ),
      },
    })
  }
  activity = reduceBuilderAiActivity(activity, {
    type: 'item-failed',
    runId,
    itemId: 'preview',
    source: 'harness',
    name: 'run_project',
    timestamp: 1_500,
    error: 'Preview failed',
    output: { phase: 'runtime' },
  })
  return reduceBuilderAiActivity(activity, {
    type: 'run-failed',
    runId,
    timestamp: 2_000,
    error: '🚀'.repeat(3_000),
  })
}

test('parses an authoritative project and conversation snapshot', () => {
  const snapshot = parseBuilderProjectSyncSnapshot({
    project: {
      id: projectId,
      ownerId: leaseOwnerId,
      forkedFromId: null,
      title: 'Chart',
      description: '',
      snapshotHash: 'a'.repeat(64),
      currentRevisionId: eventId,
      currentRevisionNumber: 2,
      lastEventSequence: 8,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    cursor: 8,
    threads: [
      {
        id: threadId,
        projectId,
        ownerId: leaseOwnerId,
        clientMutationId: mutationId,
        title: 'Build a chart',
        lastMessagePosition: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        archivedAt: null,
      },
    ],
    messages: [
      {
        id: messageId,
        projectId,
        ownerId: leaseOwnerId,
        threadId,
        runId,
        clientMutationId: messageMutationId,
        role: 'user',
        content: 'Build a chart',
        parts: [{ type: 'text', content: 'Build a chart' }],
        position: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    runs: [
      {
        id: runId,
        projectId,
        ownerId: leaseOwnerId,
        threadId,
        clientMutationId: runMutationId,
        queueKind: 'queue',
        status: 'completed',
        provider: 'openai',
        model: 'gpt-5.6-luna',
        baseRevisionId: null,
        resultRevisionId: eventId,
        leaseOwnerId: null,
        leaseFencingToken: 1,
        leaseExpiresAt: null,
        lastHeartbeatAt: timestamp,
        activity: null,
        error: null,
        startedAt: timestamp,
        completedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  })

  assert.equal(snapshot.project.currentRevisionId, eventId)
  assert.equal(snapshot.cursor, 8)
  assert.equal(snapshot.messages[0]?.position, 1)
})

test('round-trips opaque snapshot continuations and bounds every page', () => {
  const continuation: BuilderProjectSyncSnapshotContinuation = {
    version: 1,
    projectId,
    cursor: 8,
    entity: 'messages',
    afterId: messageId,
  }
  const token = encodeBuilderProjectSyncSnapshotContinuation(continuation)
  assert.match(token, /^[A-Za-z0-9_-]+$/)
  assert.deepEqual(
    parseBuilderProjectSyncSnapshotContinuation(token),
    continuation,
  )

  const project = {
    id: projectId,
    ownerId: leaseOwnerId,
    forkedFromId: null,
    title: 'Chart',
    description: '',
    snapshotHash: 'a'.repeat(64),
    currentRevisionId: eventId,
    currentRevisionNumber: 2,
    lastEventSequence: 8,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const thread = {
    id: threadId,
    projectId,
    ownerId: leaseOwnerId,
    clientMutationId: mutationId,
    title: 'Build a chart',
    lastMessagePosition: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  }
  const page = parseBuilderProjectSyncSnapshotPage({
    project,
    cursor: 8,
    headCursor: 8,
    threads: [thread],
    messages: [],
    runs: [],
    continuation: token,
  })
  assert.equal(page.continuation, token)

  assert.throws(() =>
    parseBuilderProjectSyncSnapshotPage({
      project,
      cursor: 8,
      headCursor: 8,
      threads: Array.from(
        { length: builderProjectSyncSnapshotPageMaxRows },
        () => thread,
      ),
      messages: [
        {
          id: messageId,
          projectId,
          ownerId: leaseOwnerId,
          threadId,
          runId: null,
          clientMutationId: messageMutationId,
          role: 'user',
          content: 'Build a chart',
          parts: [],
          position: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      runs: [],
      continuation: null,
    }),
  )

  const largeMessage = {
    id: messageId,
    projectId,
    ownerId: leaseOwnerId,
    threadId,
    runId: null,
    clientMutationId: messageMutationId,
    role: 'user',
    content: 'x'.repeat(200_000),
    parts: [],
    position: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const packedMessages = takeBuilderProjectSyncSnapshotPageRows(
    Array.from({ length: 8 }, () => largeMessage),
    (messages) => ({
      project,
      cursor: 8,
      headCursor: 8,
      threads: [],
      messages,
      runs: [],
      continuation: 'x'.repeat(
        builderProjectSyncSnapshotContinuationMaxCharacters,
      ),
    }),
  )
  assert.equal(packedMessages.length, 7)
  const byteBoundedPage = parseBuilderProjectSyncSnapshotPage({
    project,
    cursor: 8,
    headCursor: 8,
    threads: [],
    messages: packedMessages,
    runs: [],
    continuation: token,
  })
  assert.ok(
    getBuilderProjectSyncSnapshotPageBytes(byteBoundedPage) <=
      builderProjectSyncSnapshotPageMaxBytes,
  )
  assert.throws(() =>
    parseBuilderProjectSyncSnapshotPage({
      ...byteBoundedPage,
      messages: [...byteBoundedPage.messages, largeMessage],
    }),
  )
})

test('parses replay cursors and recognizes stream requests', () => {
  assert.equal(
    parseBuilderProjectSyncCursor(
      new Request(
        `https://tanstack.com/api/builder/projects/${projectId}/sync`,
      ),
    ),
    0,
  )
  assert.equal(
    parseBuilderProjectSyncCursor(
      new Request(
        `https://tanstack.com/api/builder/projects/${projectId}/sync?after=2`,
        { headers: { 'Last-Event-ID': '7' } },
      ),
    ),
    7,
  )
  assert.throws(() =>
    parseBuilderProjectSyncCursor(
      new Request(
        `https://tanstack.com/api/builder/projects/${projectId}/sync?after=-1`,
      ),
    ),
  )
  assert.equal(
    isBuilderProjectSyncStreamRequest(
      new Request(
        `https://tanstack.com/api/builder/projects/${projectId}/sync`,
        { headers: { Accept: 'text/event-stream' } },
      ),
    ),
    true,
  )
})

test('serializes replayable events with the sequence as the SSE id', () => {
  const event = createEvent(3)
  assert.equal(
    encodeBuilderProjectSyncEvent(event),
    `event: project-event\nid: 3\ndata: ${JSON.stringify(event)}\n\n`,
  )
})

test('streams gap-free events, heartbeats, and then reconnects', async () => {
  let time = 0
  let expiredRunChecks = 0
  const response = createBuilderProjectEventStreamResponse({
    cursor: 0,
    signal: new AbortController().signal,
    durationMs: 5,
    pollIntervalMs: 1,
    heartbeatIntervalMs: 2,
    now: () => time,
    wait: async (milliseconds) => {
      time += milliseconds
    },
    interruptExpiredRuns: async () => {
      expiredRunChecks += 1
    },
    listEvents: async (afterSequence) =>
      afterSequence === 0 ? [createEvent(1), createEvent(2)] : [],
  })

  const body = await response.text()
  assert.equal(
    response.headers.get('content-type')?.startsWith('text/event-stream'),
    true,
  )
  assert.match(body, /retry: 500/)
  assert.match(body, /id: 1/)
  assert.match(body, /id: 2/)
  assert.match(body, /: heartbeat/)
  assert.equal(expiredRunChecks, 3)
})

test('stops a replay before emitting an event across a sequence gap', async () => {
  const originalConsoleError = console.error
  console.error = () => undefined
  try {
    const response = createBuilderProjectEventStreamResponse({
      cursor: 0,
      signal: new AbortController().signal,
      durationMs: 1,
      listEvents: async () => [createEvent(2)],
    })
    const body = await response.text()
    assert.doesNotMatch(body, /id: 2/)
  } finally {
    console.error = originalConsoleError
  }
})

test('bounds events buffered by one stream response', async () => {
  const response = createBuilderProjectEventStreamResponse({
    cursor: 0,
    signal: new AbortController().signal,
    durationMs: 1_000,
    maxEvents: 2,
    listEvents: async () => [createEvent(1), createEvent(2), createEvent(3)],
  })
  const body = await response.text()
  assert.match(body, /id: 1/)
  assert.match(body, /id: 2/)
  assert.doesNotMatch(body, /id: 3/)
})

function createEvent(sequence: number): BuilderProjectSyncEvent {
  return {
    version: 1,
    id: eventId,
    projectId,
    ownerId: leaseOwnerId,
    sequence,
    type: 'message.created',
    payload: { messageId },
    clientEventId: eventId,
    clientMutationId: mutationId,
    browserSessionId: leaseOwnerId,
    threadId,
    messageId,
    runId: null,
    revisionId: null,
    occurredAt: timestamp,
    createdAt: timestamp,
  }
}

function transcriptMessageId(index: number) {
  return `cccccccc-cccc-4ccc-8ccc-${index.toString(16).padStart(12, '0')}`
}
