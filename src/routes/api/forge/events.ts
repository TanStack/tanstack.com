import { createFileRoute } from '@tanstack/react-router'
import {
  ensureForgeMetaSession,
  readForgeMetaSessionForChat,
  toLocalForgeChats,
} from '~/builder/runtime/forge-meta.server'
import {
  filterLocalForgeStateBatchAfterOffset,
  localForgeStateBatchNeedsSnapshot,
  readLocalForgeStateEvents,
  readLocalForgeSnapshotStreamEvent,
  readLocalForgeSnapshotStreamEventForRuntimeSession,
  subscribeLocalForgeStateStream,
  withLocalForgeRuntimeSession,
  type LocalForgeChat,
  type LocalForgeStateStreamBatch,
  type LocalForgeSnapshotStreamEvent,
} from '~/builder/runtime/local-store.server'
import {
  getForgeAccessErrorResponse,
  isForgeAuthBypassEnabled,
  requireForgeAccess,
} from '~/utils/forge-access.server'
import { createForgeBypassRuntimeScope } from '~/utils/forge-bypass-runtime.server'

const encoder = new TextEncoder()
const heartbeatMs = 15_000

export const Route = createFileRoute('/api/forge/events')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        let user: Awaited<ReturnType<typeof requireForgeAccess>>

        try {
          user = await requireForgeAccess(request)
        } catch (error) {
          return getForgeAccessErrorResponse(error)
        }

        const chatId = new URL(request.url).searchParams.get('chatId')

        if (isForgeAuthBypassEnabled()) {
          const scope = createForgeBypassRuntimeScope({ chatId })

          return new Response(createLocalForgeEventStream(request, scope), {
            headers: {
              'Cache-Control': 'no-store, no-transform',
              Connection: 'keep-alive',
              'Content-Type': 'text/event-stream',
              'X-Accel-Buffering': 'no',
            },
          })
        }

        const meta = chatId
          ? await readForgeMetaSessionForChat({
              chatId,
              userId: user.userId,
            })
          : await ensureForgeMetaSession(user.userId)

        if (!meta.activeChatId || !meta.activeChatSession) {
          return new Response('Forge has no active chat.', { status: 404 })
        }

        const scope: LocalForgeEventStreamScope = {
          activeChatId: meta.activeChatId,
          chats: toLocalForgeChats(meta.chats),
          runtimeSessionId: meta.activeChatSession.runtimeSessionId,
        }

        return new Response(createLocalForgeEventStream(request, scope), {
          headers: {
            'Cache-Control': 'no-store, no-transform',
            Connection: 'keep-alive',
            'Content-Type': 'text/event-stream',
            'X-Accel-Buffering': 'no',
          },
        })
      },
    },
  },
})

interface LocalForgeEventStreamScope {
  activeChatId: string
  chats: Array<LocalForgeChat>
  runtimeSessionId: string
}

export function createLocalForgeEventStream(
  request: Request,
  scope?: LocalForgeEventStreamScope,
) {
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let unsubscribe: (() => void) | undefined

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false

      function close() {
        if (closed) {
          return
        }

        closed = true
        unsubscribe?.()

        if (heartbeat) {
          clearInterval(heartbeat)
        }

        try {
          controller.close()
        } catch {
          // The client may already have closed the stream.
        }
      }

      function send(value: string) {
        if (!closed) {
          controller.enqueue(encoder.encode(value))
        }
      }

      async function runInRuntimeSession<T>(task: () => Promise<T>) {
        if (!scope) {
          return task()
        }

        return withLocalForgeRuntimeSession(scope.runtimeSessionId, task)
      }

      async function readSnapshotEvent() {
        if (!scope) {
          return readLocalForgeSnapshotStreamEvent()
        }

        return readLocalForgeSnapshotStreamEventForRuntimeSession(scope)
      }

      async function sendStateBatch(event: LocalForgeStateStreamBatch) {
        if (event.events.length === 0) {
          return
        }

        send(formatServerSentEvent(event))

        if (localForgeStateBatchNeedsSnapshot(event)) {
          send(formatServerSentEvent(await readSnapshotEvent()))
        }
      }

      const requestedStateOffset = readRequestedStateOffset(request)
      const bufferedBatches = Array<LocalForgeStateStreamBatch>()
      let lastSentStateOffset = requestedStateOffset
      let replayComplete = false
      let sendQueue = Promise.resolve()

      async function sendBatchAfterReplayOffset(
        event: LocalForgeStateStreamBatch,
      ) {
        const nextBatch = filterLocalForgeStateBatchAfterOffset(
          event,
          lastSentStateOffset,
        )

        if (!nextBatch) {
          return
        }

        lastSentStateOffset = nextBatch.stateOffset
        await sendStateBatch(nextBatch)
      }

      function enqueueLiveBatch(event: LocalForgeStateStreamBatch) {
        sendQueue = sendQueue.then(() => sendBatchAfterReplayOffset(event))
        void sendQueue.catch(close)
      }

      request.signal.addEventListener('abort', close, { once: true })
      send(': connected\n\n')
      unsubscribe = subscribeLocalForgeStateStream(
        (event) => {
          if (replayComplete) {
            enqueueLiveBatch(event)
            return
          }

          bufferedBatches.push(event)
        },
        { runtimeSessionId: scope?.runtimeSessionId },
      )

      const replayedEvents = await runInRuntimeSession(() =>
        readLocalForgeStateEvents({
          afterStateOffset: requestedStateOffset,
        }),
      )

      await sendBatchAfterReplayOffset({
        events: replayedEvents,
        stateOffset:
          replayedEvents.at(-1)?.headers.stateOffset === undefined
            ? requestedStateOffset
            : Number(replayedEvents.at(-1)?.headers.stateOffset),
        timelineOffset:
          replayedEvents.at(-1)?.headers.timelineOffset === undefined
            ? 0
            : Number(replayedEvents.at(-1)?.headers.timelineOffset),
        type: 'state-batch',
      })

      while (bufferedBatches.length > 0) {
        const batch = bufferedBatches.shift()

        if (batch) {
          await sendBatchAfterReplayOffset(batch)
        }
      }

      replayComplete = true
      heartbeat = setInterval(() => {
        send(': heartbeat\n\n')
      }, heartbeatMs)
    },
    cancel() {
      unsubscribe?.()

      if (heartbeat) {
        clearInterval(heartbeat)
      }
    },
  })
}

function formatServerSentEvent(
  event: LocalForgeSnapshotStreamEvent | LocalForgeStateStreamBatch,
) {
  return [
    `id: ${event.stateOffset}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    '',
    '',
  ].join('\n')
}

function readRequestedStateOffset(request: Request) {
  const url = new URL(request.url)
  const queryOffset = Number(url.searchParams.get('stateOffset') ?? 0)
  const headerOffset = Number(request.headers.get('Last-Event-ID') ?? 0)
  const offset = Math.max(queryOffset, headerOffset)

  return Number.isFinite(offset) && offset > 0 ? offset : 0
}
