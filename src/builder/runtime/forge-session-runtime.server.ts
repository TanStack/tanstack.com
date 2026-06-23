import type { LocalBuilderTimelineEvent } from '~/builder/projection'
import type { BuilderStateEvent } from '~/builder/schema'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'

type DurableObjectIdLike = unknown

type DurableObjectStubLike = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

type DurableObjectNamespaceLike = {
  get(id: DurableObjectIdLike): DurableObjectStubLike
  idFromName(name: string): DurableObjectIdLike
}

export type ForgeSessionTimelineResponse = {
  events: Array<LocalBuilderTimelineEvent>
  timelineOffset: number
}

export type ForgeSessionStateResponse = {
  events: Array<BuilderStateEvent>
  stateOffset: number
  timelineOffset: number
}

export type ForgeSessionTimelineAppendResponse = {
  accepted: number
  stateOffset: number
  timelineOffset: number
}

export async function getForgeSessionDurableObjectNamespace() {
  const hostEnv = await getHostRuntimeEnv()
  const namespace = hostEnv?.FORGE_SESSIONS

  return isDurableObjectNamespace(namespace) ? namespace : undefined
}

export async function hasForgeSessionDurableObjects() {
  return Boolean(await getForgeSessionDurableObjectNamespace())
}

export async function getForgeSessionDurableObjectStub(sessionId: string) {
  const namespace = await getForgeSessionDurableObjectNamespace()

  if (!namespace) {
    return undefined
  }

  return namespace.get(
    namespace.idFromName(normalizeForgeSessionName(sessionId)),
  )
}

export async function appendForgeSessionTimelineEvents({
  events,
  sessionId,
}: {
  events: Array<LocalBuilderTimelineEvent>
  sessionId: string
}) {
  const stub = await getForgeSessionDurableObjectStub(sessionId)

  if (!stub) {
    return undefined
  }

  const response = await stub.fetch(
    'https://forge-session.local/timeline/append',
    {
      body: JSON.stringify({ events }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )

  if (!response.ok) {
    throw new Error(`Forge Session DO append failed with ${response.status}.`)
  }

  return readTimelineAppendResponse(response)
}

export async function readForgeSessionTimeline(sessionId: string) {
  const stub = await getForgeSessionDurableObjectStub(sessionId)

  if (!stub) {
    return undefined
  }

  const response = await stub.fetch('https://forge-session.local/timeline')

  if (!response.ok) {
    throw new Error(
      `Forge Session DO timeline read failed with ${response.status}.`,
    )
  }

  return readTimelineResponse(response)
}

export async function readForgeSessionState(sessionId: string) {
  const stub = await getForgeSessionDurableObjectStub(sessionId)

  if (!stub) {
    return undefined
  }

  const response = await stub.fetch('https://forge-session.local/state')

  if (!response.ok) {
    throw new Error(
      `Forge Session DO state read failed with ${response.status}.`,
    )
  }

  return readStateResponse(response)
}

export async function resetForgeSessionRuntime(sessionId: string) {
  const stub = await getForgeSessionDurableObjectStub(sessionId)

  if (!stub) {
    return undefined
  }

  const response = await stub.fetch('https://forge-session.local/reset', {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(`Forge Session DO reset failed with ${response.status}.`)
  }

  return true
}

export function normalizeForgeSessionName(sessionId: string) {
  const normalized = sessionId.trim().replace(/[^a-zA-Z0-9:_-]+/g, '-')

  if (!normalized) {
    throw new Error('Forge session id is required.')
  }

  return normalized.slice(0, 128)
}

function isDurableObjectNamespace(
  value: unknown,
): value is DurableObjectNamespaceLike {
  return (
    isRecord(value) &&
    'get' in value &&
    typeof value.get === 'function' &&
    'idFromName' in value &&
    typeof value.idFromName === 'function'
  )
}

async function readTimelineResponse(
  response: Response,
): Promise<ForgeSessionTimelineResponse> {
  const value: unknown = await response.json()

  if (!isRecord(value) || !Array.isArray(value.events)) {
    throw new Error('Forge Session DO returned an invalid timeline response.')
  }

  const events = value.events.filter(isLocalBuilderTimelineEvent)

  if (events.length !== value.events.length) {
    throw new Error('Forge Session DO returned invalid timeline events.')
  }

  return {
    events,
    timelineOffset: readFiniteNumber(value.timelineOffset, events.length),
  }
}

async function readStateResponse(
  response: Response,
): Promise<ForgeSessionStateResponse> {
  const value: unknown = await response.json()

  if (!isRecord(value) || !Array.isArray(value.events)) {
    throw new Error('Forge Session DO returned an invalid state response.')
  }

  const events = value.events.filter(isBuilderStateEvent)

  if (events.length !== value.events.length) {
    throw new Error('Forge Session DO returned invalid state events.')
  }

  return {
    events,
    stateOffset: readFiniteNumber(value.stateOffset, events.length),
    timelineOffset: readFiniteNumber(value.timelineOffset, 0),
  }
}

async function readTimelineAppendResponse(
  response: Response,
): Promise<ForgeSessionTimelineAppendResponse> {
  const value: unknown = await response.json()

  if (!isRecord(value)) {
    throw new Error('Forge Session DO returned an invalid append response.')
  }

  return {
    accepted: readFiniteNumber(value.accepted, 0),
    stateOffset: readFiniteNumber(value.stateOffset, 0),
    timelineOffset: readFiniteNumber(value.timelineOffset, 0),
  }
}

function readFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isLocalBuilderTimelineEvent(
  value: unknown,
): value is LocalBuilderTimelineEvent {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    typeof value.eventId === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.type === 'string' &&
    isRecord(value.producer)
  )
}

function isBuilderStateEvent(value: unknown): value is BuilderStateEvent {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    typeof value.key === 'string' &&
    isRecord(value.headers) &&
    value.headers.schemaVersion === 1 &&
    typeof value.headers.operation === 'string' &&
    typeof value.headers.txid === 'string' &&
    typeof value.headers.timestamp === 'string' &&
    typeof value.headers.stateOffset === 'string' &&
    typeof value.headers.timelineEventId === 'string' &&
    typeof value.headers.timelineOffset === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
