import {
  BUILDER_PROJECT_EVENT_TYPES,
  type BuilderJsonObject,
  type BuilderJsonValue,
  type BuilderProjectEventType,
} from '~/db/types'

export const builderProjectEventVersion = 1
export const builderProjectEventPayloadMaxBytes = 256 * 1024
export const builderProjectEventReplayMaxLimit = 500

export type BuilderProjectEvent = {
  version: typeof builderProjectEventVersion
  id: string
  projectId: string
  ownerId: string
  threadId: string | null
  revisionId: string | null
  messageId: string | null
  runId: string | null
  sequence: number
  clientEventId: string
  clientMutationId: string | null
  browserSessionId: string | null
  type: BuilderProjectEventType
  payload: BuilderJsonObject
  occurredAt: string
  createdAt: string
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isBuilderProjectEventId(value: string) {
  return uuidPattern.test(value)
}

export function isBuilderProjectEventType(
  value: string,
): value is BuilderProjectEventType {
  return BUILDER_PROJECT_EVENT_TYPES.some((type) => type === value)
}

export function isBuilderJsonObject(
  value: unknown,
): value is BuilderJsonObject {
  return isBuilderJsonValue(value, 0) && !Array.isArray(value) && value !== null
}

export function assertBuilderProjectEventPayload(
  value: unknown,
): asserts value is BuilderJsonObject {
  if (
    !isBuilderJsonObject(value) ||
    getBuilderProjectEventPayloadBytes(value) >
      builderProjectEventPayloadMaxBytes
  ) {
    throw new Error('Invalid Builder project event payload')
  }
}

export function getBuilderProjectEventPayloadBytes(payload: BuilderJsonObject) {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength
}

export function parseBuilderProjectEvent(value: unknown): BuilderProjectEvent {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'version',
      'id',
      'projectId',
      'ownerId',
      'threadId',
      'revisionId',
      'messageId',
      'runId',
      'sequence',
      'clientEventId',
      'clientMutationId',
      'browserSessionId',
      'type',
      'payload',
      'occurredAt',
      'createdAt',
    ]) ||
    value.version !== builderProjectEventVersion ||
    !isUuid(value.id) ||
    !isUuid(value.projectId) ||
    !isUuid(value.ownerId) ||
    !isOptionalUuid(value.threadId) ||
    !isOptionalUuid(value.revisionId) ||
    !isOptionalUuid(value.messageId) ||
    !isOptionalUuid(value.runId) ||
    !isPositiveSafeInteger(value.sequence) ||
    !isUuid(value.clientEventId) ||
    !isOptionalUuid(value.clientMutationId) ||
    !isOptionalUuid(value.browserSessionId) ||
    typeof value.type !== 'string' ||
    !isBuilderProjectEventType(value.type) ||
    !hasRequiredEntityReference(value) ||
    !isBuilderProjectEventTimestamp(value.occurredAt) ||
    !isBuilderProjectEventTimestamp(value.createdAt)
  ) {
    throw new Error('Invalid Builder project event')
  }

  assertBuilderProjectEventPayload(value.payload)

  return {
    version: builderProjectEventVersion,
    id: value.id,
    projectId: value.projectId,
    ownerId: value.ownerId,
    threadId: value.threadId,
    revisionId: value.revisionId,
    messageId: value.messageId,
    runId: value.runId,
    sequence: value.sequence,
    clientEventId: value.clientEventId,
    clientMutationId: value.clientMutationId,
    browserSessionId: value.browserSessionId,
    type: value.type,
    payload: value.payload,
    occurredAt: value.occurredAt,
    createdAt: value.createdAt,
  }
}

export function isBuilderProjectEventTimestamp(
  value: unknown,
): value is string {
  if (typeof value !== 'string') return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

function isBuilderJsonValue(
  value: unknown,
  depth: number,
): value is BuilderJsonValue {
  if (depth > 32) return false
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return true
  }
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) {
    return value.every((item) => isBuilderJsonValue(item, depth + 1))
  }
  if (!isRecord(value)) return false
  return Object.values(value).every((item) =>
    isBuilderJsonValue(item, depth + 1),
  )
}

function hasRequiredEntityReference(value: Record<string, unknown>) {
  if (typeof value.type !== 'string') return false
  if (value.type.startsWith('thread.')) return isUuid(value.threadId)
  if (value.type.startsWith('revision.')) return isUuid(value.revisionId)
  if (value.type.startsWith('message.')) return isUuid(value.messageId)
  if (value.type.startsWith('run.')) return isUuid(value.runId)
  return true
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

function isOptionalUuid(value: unknown): value is string | null {
  return value === null || isUuid(value)
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
