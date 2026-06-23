import { projectLocalBuilderTimeline } from '~/builder/projection'
import type { LocalBuilderTimelineEvent } from '~/builder/projection'

const TIMELINE_STORAGE_KEY = 'timeline-events'

type DurableObjectStorageLike = {
  delete(key: string): Promise<unknown>
  get(key: string): Promise<unknown>
  put(key: string, value: unknown): Promise<unknown>
}

type DurableObjectStateLike = {
  storage: DurableObjectStorageLike
}

type TimelineAppendRequest = {
  events: Array<LocalBuilderTimelineEvent>
}

export class ForgeSessionDurableObject {
  private state: DurableObjectStateLike

  constructor(state: DurableObjectStateLike) {
    this.state = state
  }

  async fetch(request: Request) {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({
        ok: true,
        runtime: 'forge-session-do',
      })
    }

    if (request.method === 'GET' && url.pathname === '/timeline') {
      const timeline = await this.readTimeline()

      return Response.json({
        events: timeline,
        timelineOffset: timeline.length,
      })
    }

    if (request.method === 'GET' && url.pathname === '/state') {
      const timeline = await this.readTimeline()
      const stateEvents = projectLocalBuilderTimeline(timeline)

      return Response.json({
        events: stateEvents,
        stateOffset: stateEvents.length,
        timelineOffset: timeline.length,
      })
    }

    if (request.method === 'POST' && url.pathname === '/timeline/append') {
      const body = await readTimelineAppendRequest(request)

      if (!body) {
        return Response.json(
          { error: 'Invalid Forge timeline append request.' },
          { status: 400 },
        )
      }

      const { acceptedEvents, timeline } = await this.appendTimeline(
        body.events,
      )
      const stateEvents = projectLocalBuilderTimeline(timeline)

      return Response.json({
        accepted: acceptedEvents.length,
        stateOffset: stateEvents.length,
        timelineOffset: timeline.length,
      })
    }

    if (request.method === 'DELETE' && url.pathname === '/reset') {
      await this.state.storage.delete(TIMELINE_STORAGE_KEY)

      return Response.json({
        ok: true,
      })
    }

    return Response.json({ error: 'Not found.' }, { status: 404 })
  }

  private async readTimeline() {
    const stored = await this.state.storage.get(TIMELINE_STORAGE_KEY)

    return Array.isArray(stored)
      ? stored.filter(isLocalBuilderTimelineEvent)
      : []
  }

  private async appendTimeline(events: Array<LocalBuilderTimelineEvent>) {
    const existing = await this.readTimeline()
    const existingEventIds = new Set(existing.map((event) => event.eventId))
    const acceptedEvents: Array<LocalBuilderTimelineEvent> = []

    for (const event of events) {
      if (existingEventIds.has(event.eventId)) {
        continue
      }

      existingEventIds.add(event.eventId)
      acceptedEvents.push(
        rebaseTimelineEvent(event, existing.length + acceptedEvents.length + 1),
      )
    }

    if (acceptedEvents.length === 0) {
      return {
        acceptedEvents,
        timeline: existing,
      }
    }

    const next = [...existing, ...acceptedEvents]
    await this.state.storage.put(TIMELINE_STORAGE_KEY, next)

    return {
      acceptedEvents,
      timeline: next,
    }
  }
}

async function readTimelineAppendRequest(
  request: Request,
): Promise<TimelineAppendRequest | undefined> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return undefined
  }

  if (!isRecord(body) || !Array.isArray(body.events)) {
    return undefined
  }

  const events = body.events.filter(isLocalBuilderTimelineEvent)

  if (events.length !== body.events.length) {
    return undefined
  }

  return { events }
}

function rebaseTimelineEvent(
  event: LocalBuilderTimelineEvent,
  seq: number,
): LocalBuilderTimelineEvent {
  return {
    ...event,
    producer: {
      ...event.producer,
      seq,
    },
  }
}

function isLocalBuilderTimelineEvent(
  value: unknown,
): value is LocalBuilderTimelineEvent {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false
  }

  return (
    typeof value.eventId === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.createdAt === 'string' &&
    isBuilderEventType(value.type) &&
    isTimelineProducer(value.producer)
  )
}

function isTimelineProducer(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.epoch === 'string' &&
    typeof value.id === 'string' &&
    isTimelineProducerKind(value.kind) &&
    typeof value.seq === 'number'
  )
}

function isTimelineProducerKind(value: unknown) {
  switch (value) {
    case 'agent':
    case 'bridge':
    case 'normalizer':
    case 'projector':
    case 'system':
    case 'ui':
      return true
    default:
      return false
  }
}

function isBuilderEventType(value: unknown) {
  switch (value) {
    case 'agent.event.recorded':
    case 'assistant.message.completed':
    case 'assistant.message.delta':
    case 'assistant.message.started':
    case 'export.completed':
    case 'export.failed':
    case 'export.started':
    case 'file.deleted':
    case 'file.upserted':
    case 'manifest.snapshotted':
    case 'run.failed':
    case 'run.finished':
    case 'run.queued':
    case 'run.started':
    case 'session.input.received':
    case 'workflow.event.recorded':
      return true
    default:
      return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
