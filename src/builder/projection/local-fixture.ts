import {
  projectLocalBuilderTimeline,
  type LocalBuilderTimelineEvent,
} from './local'

const fixtureProjectId = 'fixture-project'
const fixtureRunId = 'fixture-run'
const fixtureSessionId = 'fixture-session'
const fixtureBaseTime = '2026-06-18T00:00:00.000Z'

export function createLocalProjectionFixtureTimeline(): Array<LocalBuilderTimelineEvent> {
  return [
    {
      createdAt: fixtureTime(0),
      eventId: 'fixture-event-001',
      projectId: fixtureProjectId,
      producer: fixtureProducer(1, 'ui'),
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'session.input.received',
      payload: {
        clientRequestId: 'fixture-client-request',
        messageId: 'fixture-user-message',
        text: 'Build a todo app',
      },
    },
    {
      createdAt: fixtureTime(1),
      eventId: 'fixture-event-002',
      projectId: fixtureProjectId,
      producer: fixtureProducer(2, 'system'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'run.queued',
      payload: {
        inputEventId: 'fixture-event-001',
        runId: fixtureRunId,
      },
    },
    {
      createdAt: fixtureTime(2),
      eventId: 'fixture-event-003',
      projectId: fixtureProjectId,
      producer: fixtureProducer(3, 'system'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'run.started',
      payload: {
        inputEventId: 'fixture-event-001',
        runId: fixtureRunId,
      },
    },
    {
      createdAt: fixtureTime(3),
      eventId: 'fixture-event-004',
      projectId: fixtureProjectId,
      producer: fixtureProducer(4, 'agent'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'file.upserted',
      payload: {
        file: {
          blobRef: 'local-blob-sha256:fixture-index',
          contentType: 'text/plain; charset=utf-8',
          encoding: 'utf8',
          lastEventId: 'fixture-event-004',
          path: 'src/routes/index.tsx',
          sha256:
            'b0d5f4584b0ef9c0a67041c3a20f9fbca86f395bf172b2deaf5e1e88f4dbf8ad',
          size: 42,
          source: 'agent',
        },
      },
    },
    {
      createdAt: fixtureTime(4),
      eventId: 'fixture-event-005',
      projectId: fixtureProjectId,
      producer: fixtureProducer(5, 'agent'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'file.deleted',
      payload: {
        path: 'src/old.ts',
        source: 'builder-definition',
      },
    },
    {
      createdAt: fixtureTime(4),
      eventId: 'fixture-event-006',
      projectId: fixtureProjectId,
      producer: fixtureProducer(6, 'agent'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'assistant.message.completed',
      payload: {
        messageId: 'fixture-assistant-message',
        runId: fixtureRunId,
        text: 'Implemented the todo app.',
      },
    },
    {
      createdAt: fixtureTime(5),
      eventId: 'fixture-event-007',
      projectId: fixtureProjectId,
      producer: fixtureProducer(7, 'system'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'run.finished',
      payload: {
        runId: fixtureRunId,
        status: 'finished',
      },
    },
    {
      createdAt: fixtureTime(6),
      eventId: 'fixture-event-008',
      projectId: fixtureProjectId,
      producer: fixtureProducer(8, 'system'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'manifest.snapshotted',
      payload: {
        blobRef: 'local-manifest-blob:fixture',
        fileCount: 1,
        manifestVersionId: 'local-manifest-sha256:fixture',
        totalBytes: 42,
      },
    },
    {
      createdAt: fixtureTime(7),
      eventId: 'fixture-event-009',
      projectId: fixtureProjectId,
      producer: fixtureProducer(9, 'system'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'export.started',
      payload: {
        exportId: 'fixture-export',
        fileName: 'fixture-app.zip',
        kind: 'zip',
        manifestVersionId: 'local-manifest-sha256:fixture',
        runId: fixtureRunId,
        startedAt: fixtureTime(7),
      },
    },
    {
      createdAt: fixtureTime(8),
      eventId: 'fixture-event-010',
      projectId: fixtureProjectId,
      producer: fixtureProducer(10, 'system'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'export.completed',
      payload: {
        byteLength: 1234,
        exportId: 'fixture-export',
        fileName: 'fixture-app.zip',
        kind: 'zip',
        manifestVersionId: 'local-manifest-sha256:fixture',
        runId: fixtureRunId,
        startedAt: fixtureTime(7),
      },
    },
    {
      createdAt: fixtureTime(9),
      eventId: 'fixture-event-011',
      projectId: fixtureProjectId,
      producer: fixtureProducer(11, 'system'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'export.started',
      payload: {
        branch: 'main',
        exportId: 'fixture-github-export',
        kind: 'github',
        manifestVersionId: 'local-manifest-sha256:fixture',
        repoName: 'fixture-app',
        runId: fixtureRunId,
        startedAt: fixtureTime(9),
        visibility: 'private',
      },
    },
    {
      createdAt: fixtureTime(10),
      eventId: 'fixture-event-012',
      projectId: fixtureProjectId,
      producer: fixtureProducer(12, 'system'),
      runId: fixtureRunId,
      schemaVersion: 1,
      sessionId: fixtureSessionId,
      type: 'export.completed',
      payload: {
        branch: 'main',
        commitSha: 'fixture-commit-sha',
        exportId: 'fixture-github-export',
        kind: 'github',
        manifestVersionId: 'local-manifest-sha256:fixture',
        repoName: 'fixture-app',
        repoOwner: 'fixture-owner',
        repoUrl: 'https://github.com/fixture-owner/fixture-app',
        runId: fixtureRunId,
        startedAt: fixtureTime(9),
        visibility: 'private',
      },
    },
  ]
}

export function createLocalProjectionFixtureState() {
  return projectLocalBuilderTimeline(createLocalProjectionFixtureTimeline())
}

function fixtureProducer(
  seq: number,
  kind: LocalBuilderTimelineEvent['producer']['kind'],
) {
  return {
    epoch: 'fixture-epoch',
    id: `fixture-${kind}`,
    kind,
    seq,
  }
}

function fixtureTime(offsetSeconds: number) {
  return new Date(
    new Date(fixtureBaseTime).getTime() + offsetSeconds * 1000,
  ).toISOString()
}
