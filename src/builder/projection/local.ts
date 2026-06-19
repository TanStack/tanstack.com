import type {
  BuilderAgentEventRow,
  BuilderExportKind,
  BuilderExportRow,
  BuilderFileRow,
  BuilderManifestFile,
  BuilderManifestRow,
  BuilderMessageRow,
  BuilderProjectedRowMeta,
  BuilderRunRow,
  BuilderRunStatus,
  BuilderStateEvent,
  BuilderTimelineEvent,
  BuilderWorkflowEventRow,
} from '~/builder/schema'

export interface LocalSessionInputReceivedPayload {
  clientRequestId: string
  messageId: string
  text: string
}

export interface LocalRunPayload {
  runId: string
  inputEventId: string
}

export interface LocalRunFinishedPayload {
  runId: string
  status: Extract<BuilderRunStatus, 'finished' | 'failed' | 'cancelled'>
  error?: string
}

export interface LocalAssistantMessageStartedPayload {
  messageId: string
  runId: string
}

export interface LocalAssistantMessageDeltaPayload {
  delta: string
  messageId: string
  runId: string
}

export interface LocalAssistantMessageCompletedPayload {
  messageId: string
  runId: string
  text: string
}

export interface LocalAgentEventRecordedPayload {
  id: string
  runId: string
  name: string
  message?: string
  detail?: string
  path?: string
  status?: BuilderRunStatus
  toolCallId?: string
  elapsedMs?: number
}

export interface LocalWorkflowEventRecordedPayload {
  id: string
  runId: string
  name: string
  message?: string
  detail?: string
  path?: string
  status?: BuilderRunStatus
  elapsedMs?: number
}

export interface LocalFileUpsertedPayload {
  file: BuilderManifestFile
}

export interface LocalFileDeletedPayload {
  path: string
  source: BuilderManifestFile['source']
}

export interface LocalManifestSnapshottedPayload {
  manifestVersionId: string
  blobRef: string
  fileCount: number
  totalBytes: number
}

export interface LocalExportStartedPayload {
  exportId: string
  manifestVersionId: string
  runId?: string
  kind: BuilderExportKind
  fileName?: string
  repoOwner?: string
  repoName?: string
  branch?: string
  visibility?: 'private' | 'public'
  startedAt: string
}

export interface LocalExportCompletedPayload {
  exportId: string
  manifestVersionId: string
  runId?: string
  kind: BuilderExportKind
  fileName?: string
  byteLength?: number
  repoOwner?: string
  repoName?: string
  repoUrl?: string
  branch?: string
  commitSha?: string
  visibility?: 'private' | 'public'
  startedAt: string
}

export interface LocalExportFailedPayload {
  exportId: string
  manifestVersionId: string
  runId?: string
  kind: BuilderExportKind
  fileName?: string
  repoOwner?: string
  repoName?: string
  branch?: string
  visibility?: 'private' | 'public'
  error: string
  startedAt: string
}

export type LocalBuilderTimelineEvent =
  | (BuilderTimelineEvent<LocalSessionInputReceivedPayload> & {
      type: 'session.input.received'
    })
  | (BuilderTimelineEvent<LocalRunPayload> & {
      type: 'run.queued' | 'run.started'
    })
  | (BuilderTimelineEvent<LocalRunFinishedPayload> & {
      type: 'run.finished' | 'run.failed'
    })
  | (BuilderTimelineEvent<LocalAssistantMessageStartedPayload> & {
      type: 'assistant.message.started'
    })
  | (BuilderTimelineEvent<LocalAssistantMessageDeltaPayload> & {
      type: 'assistant.message.delta'
    })
  | (BuilderTimelineEvent<LocalAssistantMessageCompletedPayload> & {
      type: 'assistant.message.completed'
    })
  | (BuilderTimelineEvent<LocalAgentEventRecordedPayload> & {
      type: 'agent.event.recorded'
    })
  | (BuilderTimelineEvent<LocalWorkflowEventRecordedPayload> & {
      type: 'workflow.event.recorded'
    })
  | (BuilderTimelineEvent<LocalFileUpsertedPayload> & {
      type: 'file.upserted'
    })
  | (BuilderTimelineEvent<LocalFileDeletedPayload> & {
      type: 'file.deleted'
    })
  | (BuilderTimelineEvent<LocalManifestSnapshottedPayload> & {
      type: 'manifest.snapshotted'
    })
  | (BuilderTimelineEvent<LocalExportStartedPayload> & {
      type: 'export.started'
    })
  | (BuilderTimelineEvent<LocalExportCompletedPayload> & {
      type: 'export.completed'
    })
  | (BuilderTimelineEvent<LocalExportFailedPayload> & {
      type: 'export.failed'
    })

function stateEvent<TValue extends BuilderProjectedRowMeta>({
  type,
  key,
  value,
  event,
  operation,
  stateOffset,
  timelineOffset,
}: {
  type: string
  key: string
  value: TValue
  event: LocalBuilderTimelineEvent
  operation: 'insert' | 'update' | 'delete'
  stateOffset: string
  timelineOffset: string
}): BuilderStateEvent<TValue> {
  return {
    type,
    key,
    value: {
      ...value,
      lastStateOffset: stateOffset,
    },
    headers: {
      schemaVersion: 1,
      operation,
      txid: event.eventId,
      timestamp: event.createdAt,
      stateOffset,
      timelineEventId: event.eventId,
      timelineOffset,
    },
  }
}

function rowMeta(event: LocalBuilderTimelineEvent, timelineOffset: string) {
  return {
    lastEventId: event.eventId,
    lastTimelineOffset: timelineOffset,
  }
}

export function projectLocalBuilderTimeline(
  events: Array<LocalBuilderTimelineEvent>,
): Array<BuilderStateEvent> {
  const stateEvents: Array<BuilderStateEvent> = []
  const runRows = new Map<string, BuilderRunRow>()
  const messageRows = new Map<string, BuilderMessageRow>()

  events.forEach((event, index) => {
    const timelineOffset = String(index + 1)

    switch (event.type) {
      case 'session.input.received': {
        const value: BuilderMessageRow = {
          ...rowMeta(event, timelineOffset),
          id: event.payload.messageId,
          sessionId: event.sessionId,
          role: 'user',
          status: 'complete',
          content: event.payload.text,
          createdAt: event.createdAt,
          completedAt: event.createdAt,
        }
        messageRows.set(value.id, value)

        stateEvents.push(
          stateEvent({
            type: 'messages',
            key: value.id,
            value,
            event,
            operation: 'insert',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'run.queued':
      case 'run.started': {
        const previous = runRows.get(event.payload.runId)

        if (previous && isTerminalRunStatus(previous.status)) {
          break
        }

        const value: BuilderRunRow = {
          ...previous,
          ...rowMeta(event, timelineOffset),
          id: event.payload.runId,
          sessionId: event.sessionId,
          status: event.type === 'run.queued' ? 'queued' : 'running',
          createdAt: previous?.createdAt ?? event.createdAt,
          startedAt:
            event.type === 'run.started'
              ? event.createdAt
              : previous?.startedAt,
          endedAt: undefined,
          error: undefined,
        }
        runRows.set(value.id, value)

        stateEvents.push(
          stateEvent({
            type: 'runs',
            key: value.id,
            value,
            event,
            operation: event.type === 'run.queued' ? 'insert' : 'update',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'run.finished':
      case 'run.failed': {
        const previous = runRows.get(event.payload.runId)

        if (previous && isTerminalRunStatus(previous.status)) {
          break
        }

        const value: BuilderRunRow = {
          ...previous,
          ...rowMeta(event, timelineOffset),
          id: event.payload.runId,
          sessionId: event.sessionId,
          status: event.payload.status,
          createdAt: previous?.createdAt ?? event.createdAt,
          startedAt: previous?.startedAt,
          endedAt: event.createdAt,
          error: event.payload.error,
        }
        runRows.set(value.id, value)

        stateEvents.push(
          stateEvent({
            type: 'runs',
            key: value.id,
            value,
            event,
            operation: 'update',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'assistant.message.started': {
        const previous = messageRows.get(event.payload.messageId)

        if (previous && previous.status === 'complete') {
          break
        }

        const value: BuilderMessageRow = {
          ...previous,
          ...rowMeta(event, timelineOffset),
          id: event.payload.messageId,
          runId: event.payload.runId,
          sessionId: event.sessionId,
          role: 'assistant',
          status: 'streaming',
          content: previous?.content ?? '',
          createdAt: previous?.createdAt ?? event.createdAt,
          completedAt: undefined,
        }
        messageRows.set(value.id, value)

        stateEvents.push(
          stateEvent({
            type: 'messages',
            key: value.id,
            value,
            event,
            operation: previous ? 'update' : 'insert',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'assistant.message.delta': {
        const previous = messageRows.get(event.payload.messageId)

        if (previous && previous.status === 'complete') {
          break
        }

        const value: BuilderMessageRow = {
          ...previous,
          ...rowMeta(event, timelineOffset),
          id: event.payload.messageId,
          runId: event.payload.runId,
          sessionId: event.sessionId,
          role: 'assistant',
          status: 'streaming',
          content: `${previous?.content ?? ''}${event.payload.delta}`,
          createdAt: previous?.createdAt ?? event.createdAt,
          completedAt: undefined,
        }
        messageRows.set(value.id, value)

        stateEvents.push(
          stateEvent({
            type: 'messages',
            key: value.id,
            value,
            event,
            operation: previous ? 'update' : 'insert',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'assistant.message.completed': {
        const previous = messageRows.get(event.payload.messageId)
        const value: BuilderMessageRow = {
          ...previous,
          ...rowMeta(event, timelineOffset),
          id: event.payload.messageId,
          runId: event.payload.runId,
          sessionId: event.sessionId,
          role: 'assistant',
          status: 'complete',
          content: event.payload.text,
          createdAt: previous?.createdAt ?? event.createdAt,
          completedAt: event.createdAt,
        }
        messageRows.set(value.id, value)

        stateEvents.push(
          stateEvent({
            type: 'messages',
            key: value.id,
            value,
            event,
            operation: previous ? 'update' : 'insert',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'agent.event.recorded': {
        const value: BuilderAgentEventRow = {
          ...rowMeta(event, timelineOffset),
          id: event.payload.id,
          runId: event.payload.runId,
          sessionId: event.sessionId,
          name: event.payload.name,
          message: event.payload.message,
          detail: event.payload.detail,
          path: event.payload.path,
          status: event.payload.status,
          toolCallId: event.payload.toolCallId,
          createdAt: event.createdAt,
          elapsedMs: event.payload.elapsedMs,
        }

        stateEvents.push(
          stateEvent({
            type: 'agentEvents',
            key: value.id,
            value,
            event,
            operation: 'insert',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'workflow.event.recorded': {
        const value: BuilderWorkflowEventRow = {
          ...rowMeta(event, timelineOffset),
          id: event.payload.id,
          runId: event.payload.runId,
          sessionId: event.sessionId,
          name: event.payload.name,
          message: event.payload.message,
          detail: event.payload.detail,
          path: event.payload.path,
          status: event.payload.status,
          createdAt: event.createdAt,
          elapsedMs: event.payload.elapsedMs,
        }

        stateEvents.push(
          stateEvent({
            type: 'workflowEvents',
            key: value.id,
            value,
            event,
            operation: 'insert',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'file.upserted': {
        const value: BuilderFileRow = {
          ...rowMeta(event, timelineOffset),
          id: event.payload.file.path,
          sessionId: event.sessionId,
          path: event.payload.file.path,
          status: 'active',
          blobRef: event.payload.file.blobRef,
          sha256: event.payload.file.sha256,
          size: event.payload.file.size,
          contentType: event.payload.file.contentType,
          encoding: event.payload.file.encoding,
          source: event.payload.file.source,
          updatedAt: event.createdAt,
        }

        stateEvents.push(
          stateEvent({
            type: 'files',
            key: value.id,
            value,
            event,
            operation: 'update',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'file.deleted': {
        const value: BuilderFileRow = {
          ...rowMeta(event, timelineOffset),
          id: event.payload.path,
          sessionId: event.sessionId,
          path: event.payload.path,
          status: 'deleted',
          source: event.payload.source,
          updatedAt: event.createdAt,
        }

        stateEvents.push(
          stateEvent({
            type: 'files',
            key: value.id,
            value,
            event,
            operation: 'update',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'manifest.snapshotted': {
        const value: BuilderManifestRow = {
          ...rowMeta(event, timelineOffset),
          id: event.payload.manifestVersionId,
          sessionId: event.sessionId,
          runId: event.runId,
          blobRef: event.payload.blobRef,
          fileCount: event.payload.fileCount,
          totalBytes: event.payload.totalBytes,
          createdAt: event.createdAt,
        }

        stateEvents.push(
          stateEvent({
            type: 'manifests',
            key: value.id,
            value,
            event,
            operation: 'insert',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'export.started': {
        const value: BuilderExportRow = {
          ...rowMeta(event, timelineOffset),
          id: event.payload.exportId,
          sessionId: event.sessionId,
          runId: event.payload.runId ?? event.runId,
          manifestVersionId: event.payload.manifestVersionId,
          status: 'running',
          kind: event.payload.kind,
          fileName: event.payload.fileName,
          repoOwner: event.payload.repoOwner,
          repoName: event.payload.repoName,
          branch: event.payload.branch,
          visibility: event.payload.visibility,
          startedAt: event.payload.startedAt,
        }

        stateEvents.push(
          stateEvent({
            type: 'exports',
            key: value.id,
            value,
            event,
            operation: 'insert',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'export.completed': {
        const value: BuilderExportRow = {
          ...rowMeta(event, timelineOffset),
          id: event.payload.exportId,
          sessionId: event.sessionId,
          runId: event.payload.runId ?? event.runId,
          manifestVersionId: event.payload.manifestVersionId,
          status: 'completed',
          kind: event.payload.kind,
          fileName: event.payload.fileName,
          byteLength: event.payload.byteLength,
          repoOwner: event.payload.repoOwner,
          repoName: event.payload.repoName,
          repoUrl: event.payload.repoUrl,
          branch: event.payload.branch,
          commitSha: event.payload.commitSha,
          visibility: event.payload.visibility,
          startedAt: event.payload.startedAt,
          completedAt: event.createdAt,
        }

        stateEvents.push(
          stateEvent({
            type: 'exports',
            key: value.id,
            value,
            event,
            operation: 'update',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }

      case 'export.failed': {
        const value: BuilderExportRow = {
          ...rowMeta(event, timelineOffset),
          id: event.payload.exportId,
          sessionId: event.sessionId,
          runId: event.payload.runId ?? event.runId,
          manifestVersionId: event.payload.manifestVersionId,
          status: 'failed',
          kind: event.payload.kind,
          fileName: event.payload.fileName,
          repoOwner: event.payload.repoOwner,
          repoName: event.payload.repoName,
          branch: event.payload.branch,
          visibility: event.payload.visibility,
          error: event.payload.error,
          startedAt: event.payload.startedAt,
          completedAt: event.createdAt,
        }

        stateEvents.push(
          stateEvent({
            type: 'exports',
            key: value.id,
            value,
            event,
            operation: 'update',
            stateOffset: String(stateEvents.length + 1),
            timelineOffset,
          }),
        )
        break
      }
    }
  })

  return stateEvents
}

function isTerminalRunStatus(status: BuilderRunStatus) {
  switch (status) {
    case 'cancelled':
    case 'failed':
    case 'finished':
    case 'interrupted':
      return true
    default:
      return false
  }
}
