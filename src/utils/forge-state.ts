import type { LocalForgeSnapshot } from '~/builder/runtime/local-store.server'
import type {
  BuilderExportKind,
  BuilderExportStatus,
  BuilderMessageStatus,
} from '~/builder/schema'

export type ForgeStateEvent = {
  type: string
  key: string
  value?: unknown
  headers: {
    stateOffset: string
    timelineOffset: string
  }
}

export function applyForgeStateEvents(
  session: LocalForgeSnapshot,
  events: Array<ForgeStateEvent>,
): LocalForgeSnapshot {
  return events.reduce((nextSession, event) => {
    const stateOffset = Number(event.headers.stateOffset)
    const timelineOffset = Number(event.headers.timelineOffset)
    const baseSession = {
      ...nextSession,
      stateEventCount: Number.isFinite(stateOffset)
        ? Math.max(nextSession.stateEventCount, stateOffset)
        : nextSession.stateEventCount,
      timelineEventCount: Number.isFinite(timelineOffset)
        ? Math.max(nextSession.timelineEventCount, timelineOffset)
        : nextSession.timelineEventCount,
    }

    switch (event.type) {
      case 'runs': {
        const run = readRunRow(event.value)
        return run
          ? { ...baseSession, latestRun: getLatestForgeRun(baseSession, run) }
          : baseSession
      }

      case 'messages': {
        const message = readMessageRow(event.value)
        return message
          ? {
              ...baseSession,
              messages: upsertById(baseSession.messages, message),
            }
          : baseSession
      }

      case 'agentEvents': {
        const agentEvent = readAgentEventRow(event.value)
        return agentEvent
          ? {
              ...baseSession,
              agentEvents: upsertById(baseSession.agentEvents, agentEvent),
            }
          : baseSession
      }

      case 'workflowEvents': {
        const workflowEvent = readWorkflowEventRow(event.value)
        return workflowEvent
          ? {
              ...baseSession,
              workflowEvents: upsertById(
                baseSession.workflowEvents,
                workflowEvent,
              ),
            }
          : baseSession
      }

      case 'exports': {
        const exportRow = readExportRow(event.value)
        return exportRow
          ? {
              ...baseSession,
              exports: upsertById(baseSession.exports, exportRow),
            }
          : baseSession
      }

      case 'manifests':
        // Manifest rows are followed by a full snapshot from the SSE route.
        // Applying only manifest counters here would temporarily pair new
        // manifest metadata with stale file contents.
        return baseSession

      default:
        return baseSession
    }
  }, session)
}

function readRunRow(
  value: unknown,
): NonNullable<LocalForgeSnapshot['latestRun']> | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const id = readString(value.id)
  const status = readString(value.status)

  if (!id || !status) {
    return undefined
  }

  return {
    createdAt: readString(value.createdAt),
    endedAt: readString(value.endedAt),
    error: readString(value.error),
    id,
    startedAt: readString(value.startedAt),
    status,
  }
}

function getLatestForgeRun(
  session: LocalForgeSnapshot,
  nextRun: NonNullable<LocalForgeSnapshot['latestRun']>,
) {
  const currentRun = session.latestRun

  if (!currentRun || currentRun.id === nextRun.id) {
    return nextRun
  }

  const currentTime = readRunRecencyMs(currentRun)
  const nextTime = readRunRecencyMs(nextRun)

  return nextTime >= currentTime ? nextRun : currentRun
}

function readRunRecencyMs(run: NonNullable<LocalForgeSnapshot['latestRun']>) {
  const timestamp = run.createdAt ?? run.startedAt

  if (!timestamp) {
    return 0
  }

  const parsed = Date.parse(timestamp)

  return Number.isFinite(parsed) ? parsed : 0
}

function readMessageRow(
  value: unknown,
): LocalForgeSnapshot['messages'][number] | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const createdAt = readString(value.createdAt)
  const id = readString(value.id)
  const role = readString(value.role)

  if (!createdAt || !id || !role) {
    return undefined
  }

  return {
    completedAt: readString(value.completedAt),
    content: readString(value.content),
    createdAt,
    id,
    role,
    runId: readString(value.runId),
    status: readBuilderMessageStatus(value.status) ?? 'complete',
  }
}

function readAgentEventRow(
  value: unknown,
): LocalForgeSnapshot['agentEvents'][number] | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const createdAt = readString(value.createdAt)
  const id = readString(value.id)
  const name = readString(value.name)
  const runId = readString(value.runId)

  if (!createdAt || !id || !name || !runId) {
    return undefined
  }

  return {
    createdAt,
    detail: readString(value.detail),
    elapsedMs: readNumber(value.elapsedMs),
    id,
    message: readString(value.message),
    name,
    path: readString(value.path),
    runId,
    status: readBuilderRunStatus(value.status),
    toolCallId: readString(value.toolCallId),
  }
}

function readWorkflowEventRow(
  value: unknown,
): LocalForgeSnapshot['workflowEvents'][number] | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const createdAt = readString(value.createdAt)
  const id = readString(value.id)
  const name = readString(value.name)
  const runId = readString(value.runId)

  if (!createdAt || !id || !name || !runId) {
    return undefined
  }

  return {
    createdAt,
    detail: readString(value.detail),
    elapsedMs: readNumber(value.elapsedMs),
    id,
    message: readString(value.message),
    name,
    path: readString(value.path),
    runId,
    status: readBuilderRunStatus(value.status),
  }
}

function readBuilderMessageStatus(
  value: unknown,
): BuilderMessageStatus | undefined {
  switch (value) {
    case 'cancelled':
    case 'complete':
    case 'failed':
    case 'streaming':
      return value
    default:
      return undefined
  }
}

function readExportRow(
  value: unknown,
): LocalForgeSnapshot['exports'][number] | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const fileName = readString(value.fileName)
  const id = readString(value.id)
  const manifestVersionId = readString(value.manifestVersionId)
  const startedAt = readString(value.startedAt)
  const status = readBuilderExportStatus(value.status)
  const kind = readBuilderExportKind(value.kind)

  if (!id || !kind || !manifestVersionId || !startedAt || !status) {
    return undefined
  }

  return {
    branch: readString(value.branch),
    byteLength: readNumber(value.byteLength),
    commitSha: readString(value.commitSha),
    completedAt: readString(value.completedAt),
    error: readString(value.error),
    fileName,
    id,
    kind,
    manifestVersionId,
    repoName: readString(value.repoName),
    repoOwner: readString(value.repoOwner),
    repoUrl: readString(value.repoUrl),
    runId: readString(value.runId),
    startedAt,
    status,
    visibility: readExportVisibility(value.visibility),
  }
}

function upsertById<TItem extends { id: string }>(
  items: Array<TItem>,
  nextItem: TItem,
) {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id)

  if (existingIndex === -1) {
    return [...items, nextItem]
  }

  return items.map((item, index) => (index === existingIndex ? nextItem : item))
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function readNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function readBuilderRunStatus(
  value: unknown,
): LocalForgeSnapshot['agentEvents'][number]['status'] {
  switch (value) {
    case 'cancelled':
    case 'failed':
    case 'finished':
    case 'finishing':
    case 'interrupted':
    case 'paused':
    case 'queued':
    case 'running':
    case 'starting':
      return value
    default:
      return undefined
  }
}

function readBuilderExportStatus(
  value: unknown,
): BuilderExportStatus | undefined {
  switch (value) {
    case 'completed':
    case 'failed':
    case 'running':
      return value
    default:
      return undefined
  }
}

function readBuilderExportKind(value: unknown): BuilderExportKind | undefined {
  switch (value) {
    case 'github':
    case 'zip':
      return value
    default:
      return undefined
  }
}

function readExportVisibility(value: unknown) {
  switch (value) {
    case 'private':
    case 'public':
      return value
    default:
      return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
