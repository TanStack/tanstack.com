import { EventType, type StreamChunk } from '@tanstack/ai'
import { createFileRoute } from '@tanstack/react-router'
import {
  ensureForgeMetaSession,
  readForgeMetaSessionForChat,
  selectForgeMetaChatSession,
  toLocalForgeChats,
} from '~/builder/runtime/forge-meta.server'
import {
  forgeRequiresByokForRuns,
  unsealForgeProviderKey,
  type ForgeProviderCredential,
} from '~/builder/runtime/forge-byok.server'
import {
  startLocalForgeAgentRun,
} from '~/builder/runtime/local-agent.server'
import {
  filterLocalForgeStateBatchAfterOffset,
  localForgeStateBatchNeedsSnapshot,
  readLocalForgeSnapshotStreamEventForRuntimeSession,
  subscribeLocalForgeStateStream,
  withLocalForgeRuntimeSession,
  type LocalForgeChat,
  type LocalForgeSnapshot,
  type LocalForgeSnapshotStreamEvent,
  type LocalForgeStateStreamBatch,
} from '~/builder/runtime/local-store.server'
import {
  getForgeAccessErrorResponse,
  isForgeAuthBypassEnabled,
  requireForgeAccess,
} from '~/utils/forge-access.server'
import {
  createForgeBypassRuntimeScope,
} from '~/utils/forge-bypass-runtime.server'

const encoder = new TextEncoder()

export const Route = createFileRoute('/api/forge/chat')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let user: Awaited<ReturnType<typeof requireForgeAccess>>

        try {
          user = await requireForgeAccess(request)
        } catch (error) {
          return getForgeAccessErrorResponse(error)
        }

        const requestBody = await readForgeChatRequestBody(request)
        const input = readForgeChatRequestInput(requestBody)

        if (!input) {
          return createForgeAiChatErrorResponse({
            error: 'Invalid Forge chat request.',
            identity: readForgeChatRequestIdentity(requestBody),
          })
        }

        let providerCredential: ForgeProviderCredential | undefined

        try {
          providerCredential = input.providerKey
            ? unsealForgeProviderKey({
                provider: input.providerKey.provider,
                sealedKey: input.providerKey.sealedKey,
                userId: user.userId,
              })
            : undefined
        } catch (error) {
          return createForgeAiChatErrorResponse({
            error,
            identity: input,
          })
        }

        if (!providerCredential && forgeRunRequiresBrowserProviderKey()) {
          return createForgeAiChatErrorResponse({
            error: 'Add a Forge provider key before starting a run.',
            identity: input,
          })
        }

        let scope: ForgeAiChatScope

        try {
          scope = isForgeAuthBypassEnabled()
            ? resolveForgeBypassChatScope(input)
            : await resolveForgeChatScope({
                chatId: input.chatId,
                userId: user.userId,
              })
        } catch (error) {
          return createForgeAiChatErrorResponse({
            error,
            identity: input,
          })
        }

        return new Response(
          createForgeAiChatStream({
            clientRequestId: input.clientRequestId,
            ...(input.previewUrl ? { previewUrl: input.previewUrl } : {}),
            prompt: input.prompt,
            providerCredential,
            request,
            scope,
          }),
          {
            headers: {
              'Cache-Control': 'no-store, no-transform',
              Connection: 'keep-alive',
              'Content-Type': 'text/event-stream',
              'X-Accel-Buffering': 'no',
            },
          },
        )
      },
    },
  },
})

interface ForgeAiChatScope {
  activeChatId: string
  chats: Array<LocalForgeChat>
  runtimeSessionId: string
}

interface ForgeAiChatRequestInput {
  chatId: string
  clientRequestId: string
  previewUrl?: string
  prompt: string
  providerKey?: ForgeBrowserProviderKeyInput
}

interface ForgeAiChatRequestIdentity {
  chatId?: string
  clientRequestId?: string
}

interface ForgeBrowserProviderKeyInput {
  fingerprint: string
  model?: string
  provider: 'anthropic' | 'openai'
  sealedKey: string
}

function createForgeAiChatStream({
  clientRequestId,
  previewUrl,
  prompt,
  providerCredential,
  request,
  scope,
}: {
  clientRequestId: string
  previewUrl?: string
  prompt: string
  providerCredential?: ForgeProviderCredential
  request: Request
  scope: ForgeAiChatScope
}) {
  let unsubscribe: (() => void) | undefined

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      let lastSentStateOffset = 0
      let replayComplete = false
      let liveRunId: string | undefined
      let sendQueue = Promise.resolve()
      const bufferedBatches = Array<LocalForgeStateStreamBatch>()

      function close() {
        if (closed) {
          return
        }

        closed = true
        unsubscribe?.()

        try {
          controller.close()
        } catch {
          // The browser may already have closed the request.
        }
      }

      function sendChunk(chunk: StreamChunk) {
        if (!closed) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
          )
        }
      }

      async function sendSnapshot() {
        sendChunk(
          toForgeCustomStreamChunk(
            'forge.snapshot',
            await readLocalForgeSnapshotStreamEventForRuntimeSession(scope),
          ),
        )
      }

      async function sendStateBatch(event: LocalForgeStateStreamBatch) {
        const nextBatch = filterLocalForgeStateBatchAfterOffset(
          event,
          lastSentStateOffset,
        )

        if (!nextBatch) {
          return
        }

        lastSentStateOffset = nextBatch.stateOffset
        liveRunId = liveRunId ?? readRunIdFromStateBatch(nextBatch)
        sendChunk(toForgeCustomStreamChunk('forge.state-batch', nextBatch))

        if (localForgeStateBatchNeedsSnapshot(nextBatch)) {
          await sendSnapshot()
        }

        if (liveRunId && stateBatchHasTerminalRun(nextBatch, liveRunId)) {
          sendChunk({
            type: EventType.RUN_FINISHED,
            finishReason: 'stop',
            runId: clientRequestId,
            threadId: scope.activeChatId,
            timestamp: Date.now(),
          })
          close()
        }
      }

      function enqueueLiveBatch(event: LocalForgeStateStreamBatch) {
        sendQueue = sendQueue.then(() => sendStateBatch(event))
        void sendQueue.catch((error: unknown) => {
          sendRunError(error, sendChunk, clientRequestId, scope.activeChatId)
          close()
        })
      }

      request.signal.addEventListener('abort', close, { once: true })

      unsubscribe = subscribeLocalForgeStateStream(
        (event) => {
          if (replayComplete) {
            enqueueLiveBatch(event)
            return
          }

          bufferedBatches.push(event)
        },
        { runtimeSessionId: scope.runtimeSessionId },
      )

      sendChunk({
        type: EventType.RUN_STARTED,
        runId: clientRequestId,
        threadId: scope.activeChatId,
        timestamp: Date.now(),
      })

      try {
        const startedSnapshot = await withLocalForgeRuntimeSession(
          scope.runtimeSessionId,
          () =>
            startLocalForgeAgentRun({
              clientRequestId,
              ...(previewUrl ? { existingPreviewUrl: previewUrl } : {}),
              prompt,
              providerCredential,
              publicHost: new URL(request.url).host,
            }),
        )

        liveRunId = startedSnapshot.latestRun?.id ?? liveRunId

        await sendSnapshot()

        while (bufferedBatches.length > 0) {
          const batch = bufferedBatches.shift()

          if (batch) {
            await sendStateBatch(batch)
          }
        }

        replayComplete = true

        if (startedSnapshot.latestRun && runIsTerminal(startedSnapshot)) {
          sendChunk({
            type: EventType.RUN_FINISHED,
            finishReason: 'stop',
            runId: clientRequestId,
            threadId: scope.activeChatId,
            timestamp: Date.now(),
          })
          close()
        }
      } catch (error) {
        sendRunError(error, sendChunk, clientRequestId, scope.activeChatId)
        close()
      }
    },
    cancel() {
      unsubscribe?.()
    },
  })
}

function createForgeAiChatErrorResponse({
  error,
  identity,
}: {
  error: unknown
  identity: ForgeAiChatRequestIdentity
}) {
  return new Response(createForgeAiChatErrorStream({ error, identity }), {
    headers: {
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
      'X-Accel-Buffering': 'no',
    },
  })
}

function createForgeAiChatErrorStream({
  error,
  identity,
}: {
  error: unknown
  identity: ForgeAiChatRequestIdentity
}) {
  const runId = identity.clientRequestId ?? `forge-request-${crypto.randomUUID()}`
  const threadId = identity.chatId ?? 'forge-chat:invalid'

  return new ReadableStream<Uint8Array>({
    start(controller) {
      function sendChunk(chunk: StreamChunk) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      }

      sendChunk({
        type: EventType.RUN_STARTED,
        runId,
        threadId,
        timestamp: Date.now(),
      })
      sendRunError(error, sendChunk, runId, threadId)
      controller.close()
    },
  })
}

function toForgeCustomStreamChunk(
  name: 'forge.snapshot' | 'forge.state-batch',
  value: LocalForgeSnapshotStreamEvent | LocalForgeStateStreamBatch,
): StreamChunk {
  return {
    type: EventType.CUSTOM,
    name,
    value,
    timestamp: Date.now(),
  }
}

function sendRunError(
  error: unknown,
  sendChunk: (chunk: StreamChunk) => void,
  runId: string,
  threadId: string,
) {
  const message = readRunErrorMessage(error)

  sendChunk({
    type: EventType.RUN_ERROR,
    error: { message },
    message,
    runId,
    threadId,
    timestamp: Date.now(),
  })
}

function readRunErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  if (isRecord(error)) {
    const message = readTrimmedString(error.message)

    if (message) {
      return message
    }
  }

  return 'Forge run failed to start.'
}

async function resolveForgeChatScope({
  chatId,
  userId,
}: {
  chatId: string
  userId: string
}): Promise<ForgeAiChatScope> {
  const meta = chatId
    ? await selectForgeMetaChatSession({ chatId, userId })
    : await ensureForgeMetaSession(userId)

  const activeChatId = meta.activeChatId
  const activeChatSession = meta.activeChatSession

  if (!activeChatId || !activeChatSession) {
    throw new Error('Forge has no active chat.')
  }

  const chatMeta =
    activeChatId === chatId
      ? meta
      : await readForgeMetaSessionForChat({ chatId: activeChatId, userId })

  return {
    activeChatId,
    chats: toLocalForgeChats(chatMeta.chats),
    runtimeSessionId: activeChatSession.runtimeSessionId,
  }
}

function resolveForgeBypassChatScope(input: ForgeAiChatRequestInput) {
  return createForgeBypassRuntimeScope({
    chatId: input.chatId,
    title: input.prompt,
  })
}

function forgeRunRequiresBrowserProviderKey() {
  return forgeRequiresByokForRuns()
}

function readForgeChatRequestInput(value: unknown) {
  if (!isRecord(value)) {
    return undefined
  }

  const forwardedProps = readRecord(value.forwardedProps) ?? readRecord(value.data)
  const chatId = readTrimmedString(forwardedProps?.chatId)
  const clientRequestId = readTrimmedString(forwardedProps?.clientRequestId)
  const prompt =
    readTrimmedString(forwardedProps?.prompt) ??
    readPromptFromMessages(value.messages)
  const previewUrl = readForgePreviewUrlInput(forwardedProps?.previewUrl)
  const providerKey = readForgeBrowserProviderKey(forwardedProps?.providerKey)

  if (!chatId || !clientRequestId || !prompt) {
    return undefined
  }

  return {
    chatId,
    clientRequestId,
    ...(previewUrl ? { previewUrl } : {}),
    prompt,
    providerKey,
  } satisfies ForgeAiChatRequestInput
}

async function readForgeChatRequestBody(request: Request) {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

function readForgeChatRequestIdentity(value: unknown): ForgeAiChatRequestIdentity {
  if (!isRecord(value)) {
    return {}
  }

  const forwardedProps = readRecord(value.forwardedProps) ?? readRecord(value.data)
  const chatId =
    readTrimmedString(forwardedProps?.chatId) ??
    readTrimmedString(value.threadId)
  const clientRequestId =
    readTrimmedString(forwardedProps?.clientRequestId) ??
    readTrimmedString(value.runId)

  return {
    chatId,
    clientRequestId,
  }
}

function readPromptFromMessages(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  for (const message of [...value].reverse()) {
    if (!isRecord(message) || message.role !== 'user') {
      continue
    }

    const content = readTrimmedString(message.content)

    if (content) {
      return content
    }

    const parts = Array.isArray(message.content) ? message.content : undefined

    if (!parts) {
      continue
    }

    const text = parts
      .map((part) => (isRecord(part) ? readTrimmedString(part.text) : undefined))
      .filter((part): part is string => Boolean(part))
      .join('\n')
      .trim()

    if (text) {
      return text
    }
  }

  return undefined
}

function readForgePreviewUrlInput(value: unknown) {
  const text = readTrimmedString(value)

  if (!text) {
    return undefined
  }

  try {
    const url = new URL(text)

    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

function readForgeBrowserProviderKey(value: unknown) {
  if (!isRecord(value)) {
    return undefined
  }

  const fingerprint = readTrimmedString(value.fingerprint)
  const provider = readForgeProvider(value.provider)
  const sealedKey = readTrimmedString(value.sealedKey)
  const model = readTrimmedString(value.model)

  if (!fingerprint || !provider || !sealedKey) {
    return undefined
  }

  return {
    fingerprint,
    model,
    provider,
    sealedKey,
  } satisfies ForgeBrowserProviderKeyInput
}

function readForgeProvider(value: unknown) {
  switch (value) {
    case 'anthropic':
    case 'openai':
      return value
    default:
      return undefined
  }
}

function readRunIdFromStateBatch(event: LocalForgeStateStreamBatch) {
  for (const stateEvent of event.events) {
    if (stateEvent.type !== 'runs' || !isRecord(stateEvent.value)) {
      continue
    }

    const id = readTrimmedString(stateEvent.value.id)

    if (id) {
      return id
    }
  }

  return undefined
}

function stateBatchHasTerminalRun(
  event: LocalForgeStateStreamBatch,
  runId: string,
) {
  return event.events.some((stateEvent) => {
    if (stateEvent.type !== 'runs' || !isRecord(stateEvent.value)) {
      return false
    }

    return (
      stateEvent.value.id === runId &&
      typeof stateEvent.value.status === 'string' &&
      isTerminalForgeRunStatus(stateEvent.value.status)
    )
  })
}

function runIsTerminal(snapshot: LocalForgeSnapshot) {
  return Boolean(
    snapshot.latestRun && isTerminalForgeRunStatus(snapshot.latestRun.status),
  )
}

function isTerminalForgeRunStatus(status: string) {
  return (
    status === 'cancelled' ||
    status === 'failed' ||
    status === 'finished' ||
    status === 'interrupted'
  )
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : undefined
}

function readTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
