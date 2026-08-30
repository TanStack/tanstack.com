import type { BuilderProjectSyncEvent } from './builder-project-sync'

const defaultStreamDurationMs = 20_000
const defaultPollIntervalMs = 1_000
const defaultHeartbeatIntervalMs = 10_000
const defaultMaxEvents = 25
const textEncoder = new TextEncoder()

type BuilderProjectEventStreamOptions = {
  cursor: number
  signal: AbortSignal
  headers?: HeadersInit
  listEvents: (
    afterSequence: number,
  ) => Promise<ReadonlyArray<BuilderProjectSyncEvent>>
  interruptExpiredRuns?: () => Promise<void>
  durationMs?: number
  pollIntervalMs?: number
  heartbeatIntervalMs?: number
  maxEvents?: number
  now?: () => number
  wait?: (milliseconds: number) => Promise<void>
}

export function parseBuilderProjectSyncCursor(request: Request) {
  const url = new URL(request.url)
  const queryValues = url.searchParams.getAll('after')
  if (queryValues.length > 1) {
    throw new Error('Invalid Builder project sync cursor')
  }

  const lastEventId = request.headers.get('last-event-id')?.trim()
  const value = lastEventId || queryValues[0]
  if (value === undefined || value === '') return 0
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error('Invalid Builder project sync cursor')
  }

  const cursor = Number(value)
  if (!Number.isSafeInteger(cursor)) {
    throw new Error('Invalid Builder project sync cursor')
  }
  return cursor
}

export function isBuilderProjectSyncStreamRequest(request: Request) {
  const url = new URL(request.url)
  return (
    request.headers.get('accept')?.includes('text/event-stream') === true ||
    url.searchParams.get('stream') === '1'
  )
}

export function encodeBuilderProjectSyncEvent(event: BuilderProjectSyncEvent) {
  return `event: project-event\nid: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`
}

export function createBuilderProjectEventStreamResponse(
  options: BuilderProjectEventStreamOptions,
) {
  const now = options.now ?? Date.now
  const wait = options.wait ?? waitForDelay
  const durationMs = options.durationMs ?? defaultStreamDurationMs
  const pollIntervalMs = options.pollIntervalMs ?? defaultPollIntervalMs
  const heartbeatIntervalMs =
    options.heartbeatIntervalMs ?? defaultHeartbeatIntervalMs
  const maxEvents = options.maxEvents ?? defaultMaxEvents
  const headers = new Headers(options.headers)
  headers.set('Cache-Control', 'no-store, no-transform')
  headers.set('Content-Type', 'text/event-stream; charset=utf-8')
  headers.set('X-Content-Type-Options', 'nosniff')

  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = now()
      let heartbeatAt = startedAt
      let expiredRunsCheckedAt = startedAt - heartbeatIntervalMs
      let cursor = options.cursor
      let deliveredEvents = 0

      controller.enqueue(textEncoder.encode('retry: 500\n\n'))

      try {
        while (
          !cancelled &&
          !options.signal.aborted &&
          deliveredEvents < maxEvents &&
          now() - startedAt < durationMs
        ) {
          const currentTime = now()
          if (
            options.interruptExpiredRuns &&
            currentTime - expiredRunsCheckedAt >= heartbeatIntervalMs
          ) {
            await options.interruptExpiredRuns()
            expiredRunsCheckedAt = currentTime
          }

          const events = await options.listEvents(cursor)
          for (const event of events) {
            if (event.sequence !== cursor + 1) {
              throw new Error(
                `Builder project event sequence gap after ${cursor}`,
              )
            }
            controller.enqueue(
              textEncoder.encode(encodeBuilderProjectSyncEvent(event)),
            )
            cursor = event.sequence
            deliveredEvents += 1
            if (deliveredEvents >= maxEvents) break
          }

          const afterQueryTime = now()
          if (afterQueryTime - heartbeatAt >= heartbeatIntervalMs) {
            controller.enqueue(textEncoder.encode(': heartbeat\n\n'))
            heartbeatAt = afterQueryTime
          }

          if (events.length === 0) {
            await wait(pollIntervalMs)
          }
        }
      } catch (error) {
        if (!cancelled && !options.signal.aborted) {
          console.error('Builder project event stream failed:', error)
        }
      } finally {
        if (!cancelled) {
          controller.close()
        }
      }
    },
    cancel() {
      cancelled = true
    },
  })

  return new Response(stream, { headers })
}

function waitForDelay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}
