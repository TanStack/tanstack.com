import type { StreamChunk } from '@tanstack/ai'
import { fetchServerSentEvents, type UIMessage } from '@tanstack/ai-client'
import {
  parseNotebookAiResponse,
  type NotebookAiMessage,
  type NotebookAiResponse,
} from './notebook-ai'
import type {
  NotebookAiActivityEvent,
  NotebookAiActivitySource,
} from './notebook-ai-activity'

export async function runNotebookAiStream({
  endpoint,
  forwardedProps,
  messages,
  signal,
  threadId,
  activityId,
  includeReasoningSummaries = false,
  onActivityEvent,
  onChunk,
  onText,
}: {
  endpoint: string
  forwardedProps: Record<string, unknown>
  messages: ReadonlyArray<NotebookAiMessage & { id?: string }>
  signal: AbortSignal
  threadId: string
  activityId: string
  includeReasoningSummaries?: boolean
  onActivityEvent?: (event: NotebookAiActivityEvent) => void
  onChunk?: (chunk: StreamChunk) => void
  onText?: (text: string) => void
}): Promise<NotebookAiResponse> {
  const runId = crypto.randomUUID()
  const connection = fetchServerSentEvents(endpoint)
  const toolArguments = new Map<string, string>()
  const toolNames = new Map<string, string>()
  const reasoning = new Map<string, string>()
  let pendingResult: NotebookAiResponse | undefined
  let completedResult: NotebookAiResponse | undefined
  let expectingTerminal = false
  let sawTerminal = false
  let activeMessageId = ''
  let text = ''

  onActivityEvent?.({
    type: 'run-started',
    runId: activityId,
    timestamp: Date.now(),
  })

  for await (const chunk of connection.connect(
    toUiMessages(messages, runId),
    undefined,
    signal,
    { threadId, runId, forwardedProps },
  )) {
    if (sawTerminal) {
      throw new Error('Notebook AI returned events after the run finished')
    }
    if (
      expectingTerminal &&
      chunk.type !== 'RUN_FINISHED' &&
      chunk.type !== 'RUN_ERROR'
    ) {
      throw new Error('Notebook AI returned an invalid execution result')
    }

    onChunk?.(chunk)
    observeTextChunk(chunk)
    observeActivityChunk(chunk)

    if (chunk.type === 'CUSTOM' && chunk.name === 'notebook.execution') {
      if (pendingResult || completedResult) {
        throw new Error('Notebook AI returned duplicate execution results')
      }
      pendingResult = parseNotebookAiResponse(chunk.value)
      expectingTerminal = true
    }
    if (chunk.type === 'RUN_ERROR') throw new Error(chunk.message)
    if (chunk.type === 'RUN_FINISHED') {
      if (chunk.finishReason === 'tool_calls') {
        if (pendingResult) {
          throw new Error('Notebook AI returned a partial execution result')
        }
        continue
      }
      if (chunk.outcome?.type === 'interrupt') {
        throw new Error('Notebook AI was interrupted')
      }
      if (!pendingResult) {
        throw new Error('Notebook AI returned no execution result')
      }
      completedResult = pendingResult
      pendingResult = undefined
      expectingTerminal = false
      sawTerminal = true
    }
  }

  if (!completedResult || !sawTerminal) {
    throw new Error('Notebook AI stream ended before the run finished')
  }
  return completedResult

  function observeTextChunk(chunk: StreamChunk) {
    if (chunk.type === 'TEXT_MESSAGE_START') {
      activeMessageId = chunk.messageId
      text = ''
      onText?.(text)
      return
    }
    if (chunk.type !== 'TEXT_MESSAGE_CONTENT') return
    if (activeMessageId !== chunk.messageId) {
      activeMessageId = chunk.messageId
      text = ''
    }
    text += chunk.delta
    onText?.(text)
  }

  function observeActivityChunk(chunk: StreamChunk) {
    const timestamp = readTimestamp(chunk)

    if (chunk.type === 'TOOL_CALL_START') {
      toolNames.set(chunk.toolCallId, chunk.toolCallName)
      emitItem('item-started', chunk.toolCallId, chunk.toolCallName, timestamp)
      return
    }

    if (chunk.type === 'TOOL_CALL_ARGS') {
      const argumentsText =
        chunk.args ??
        `${toolArguments.get(chunk.toolCallId) ?? ''}${chunk.delta}`
      toolArguments.set(chunk.toolCallId, argumentsText)
      const name = toolNames.get(chunk.toolCallId) ?? 'tool'
      emitItem(
        'item-running',
        chunk.toolCallId,
        name,
        timestamp,
        parseJson(argumentsText),
      )
      return
    }

    if (chunk.type === 'TOOL_CALL_END') {
      const name =
        chunk.toolCallName ??
        chunk.toolName ??
        toolNames.get(chunk.toolCallId) ??
        'tool'
      toolNames.set(chunk.toolCallId, name)
      const input =
        chunk.input ?? parseJson(toolArguments.get(chunk.toolCallId))
      if (chunk.state === 'output-error') {
        onActivityEvent?.({
          type: 'item-failed',
          runId: activityId,
          itemId: activityItemId(chunk.toolCallId),
          source: 'tool',
          name,
          timestamp,
          error: readToolError(chunk.result),
        })
      } else if (
        chunk.state === 'output-available' ||
        chunk.output !== undefined
      ) {
        emitItem(
          'item-completed',
          chunk.toolCallId,
          name,
          timestamp,
          chunk.output ??
            (typeof chunk.result === 'string'
              ? parseJson(chunk.result)
              : undefined),
        )
      } else {
        emitItem('item-running', chunk.toolCallId, name, timestamp, input)
      }
      return
    }

    if (chunk.type === 'TOOL_CALL_RESULT') {
      const name = toolNames.get(chunk.toolCallId) ?? 'tool'
      if (chunk.state === 'output-error') {
        onActivityEvent?.({
          type: 'item-failed',
          runId: activityId,
          itemId: activityItemId(chunk.toolCallId),
          source: 'tool',
          name,
          timestamp,
          error: readToolError(chunk.content),
        })
      } else {
        onActivityEvent?.({
          type: 'item-completed',
          runId: activityId,
          itemId: activityItemId(chunk.toolCallId),
          source: 'tool',
          name,
          timestamp,
          output: parseJson(chunk.content) ?? { message: chunk.content },
        })
      }
      return
    }

    if (!includeReasoningSummaries) return

    if (chunk.type === 'REASONING_MESSAGE_START') {
      reasoning.set(chunk.messageId, '')
      emitItem(
        'item-started',
        `reasoning:${chunk.messageId}`,
        'reasoning',
        timestamp,
      )
      return
    }

    if (chunk.type === 'REASONING_MESSAGE_CONTENT') {
      const summary = `${reasoning.get(chunk.messageId) ?? ''}${chunk.delta}`
      reasoning.set(chunk.messageId, summary)
      emitItem(
        'item-running',
        `reasoning:${chunk.messageId}`,
        'reasoning',
        timestamp,
        { message: summary },
      )
      return
    }

    if (chunk.type === 'REASONING_MESSAGE_END') {
      emitItem(
        'item-completed',
        `reasoning:${chunk.messageId}`,
        'reasoning',
        timestamp,
        { message: reasoning.get(chunk.messageId) ?? '' },
      )
    }
  }

  function emitItem(
    type: 'item-started' | 'item-running' | 'item-completed',
    itemId: string,
    name: string,
    timestamp: number,
    value?: unknown,
  ) {
    const source: NotebookAiActivitySource =
      name === 'reasoning' ? 'reasoning' : 'tool'
    const common = {
      runId: activityId,
      itemId: activityItemId(itemId),
      source,
      name,
      timestamp,
    }
    onActivityEvent?.(
      type === 'item-completed'
        ? { ...common, type, output: value }
        : { ...common, type, input: value },
    )
  }

  function activityItemId(itemId: string) {
    return `${runId}:${itemId}`
  }
}

function toUiMessages(
  messages: ReadonlyArray<NotebookAiMessage & { id?: string }>,
  runId: string,
): Array<UIMessage> {
  return messages.map((message, index) => ({
    id: message.id ?? `${runId}:message:${index}`,
    role: message.role,
    parts: [{ type: 'text', content: message.content }],
  }))
}

function parseJson(source: string | undefined): unknown {
  if (!source) return undefined
  try {
    return JSON.parse(source)
  } catch {
    return undefined
  }
}

function readTimestamp(chunk: StreamChunk) {
  return 'timestamp' in chunk && typeof chunk.timestamp === 'number'
    ? chunk.timestamp
    : Date.now()
}

function readToolError(value: unknown) {
  const parsed = typeof value === 'string' ? (parseJson(value) ?? value) : value
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    'error' in parsed &&
    typeof parsed.error === 'string'
  ) {
    return parsed.error
  }
  return typeof parsed === 'string' ? parsed : 'Notebook tool failed'
}
