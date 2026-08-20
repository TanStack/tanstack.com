import type { StreamChunk } from '@tanstack/ai'
import {
  ChatClient,
  clientTools,
  fetchServerSentEvents,
  type UIMessage,
} from '@tanstack/ai-client'
import {
  parseNotebookAiResponse,
  parseNotebookAiExecution,
  serializeNotebookAiExecution,
  type NotebookAiMessage,
  type NotebookAiResponse,
} from './notebook-ai'
import type {
  NotebookAiActivityEvent,
  NotebookAiActivitySource,
} from './notebook-ai-activity'
import type { NotebookAiRepairContext } from './notebook-ai-progress'
import {
  notebookAiLocalValidationEndpoint,
  notebookAiLocalValidationEvent,
  parseNotebookAiLocalValidationRequest,
} from './notebook-ai-local-validation'
import {
  parseNotebookAiValidationResult,
  parseNotebookAiValidationState,
  validateNotebookAiTool,
  type NotebookAiValidationState,
} from './notebook-ai-validation'
import { getChangedNotebookAiFiles } from './notebook-ai-workspace'

export type NotebookAiStreamValidationOutcome = {
  result: ReturnType<typeof parseNotebookAiValidationResult>
  repair?: NotebookAiRepairContext
}

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
  onLocalValidate,
  onValidate,
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
  onLocalValidate?: (
    state: NotebookAiValidationState,
  ) => Promise<NotebookAiStreamValidationOutcome>
  onValidate?: (
    state: NotebookAiValidationState,
  ) => Promise<NotebookAiStreamValidationOutcome>
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

  if (onLocalValidate && onValidate) {
    throw new Error('Notebook AI cannot use two validation transports')
  }
  if (onLocalValidate) {
    return runLocallyValidatedStream(onLocalValidate)
  }
  if (onValidate) {
    return runValidatedStream(onValidate)
  }

  for await (const chunk of connection.connect(
    toUiMessages(messages, runId),
    undefined,
    signal,
    { threadId, runId, forwardedProps },
  )) {
    observeProtocolChunk(chunk, false)
  }

  if (!completedResult || !sawTerminal) {
    throw new Error('Notebook AI stream ended before the run finished')
  }
  return completedResult

  async function runLocallyValidatedStream(
    validate: (
      state: NotebookAiValidationState,
    ) => Promise<NotebookAiStreamValidationOutcome>,
  ) {
    const baselineExecution = parseNotebookAiExecution(forwardedProps.execution)
    let validatedExecution = ''
    let validationError = ''

    for await (const chunk of connection.connect(
      toUiMessages(messages, runId),
      undefined,
      signal,
      { threadId, runId, forwardedProps },
    )) {
      observeProtocolChunk(chunk, false)
      if (
        chunk.type !== 'CUSTOM' ||
        chunk.name !== notebookAiLocalValidationEvent
      ) {
        continue
      }

      const request = parseNotebookAiLocalValidationRequest(chunk.value)
      const outcome = await validate(request.state)
      const result = parseNotebookAiValidationResult(outcome.result)
      await submitLocalValidation({
        requestId: request.requestId,
        result,
        ...(outcome.repair ? { repair: outcome.repair } : {}),
      })
      if (result.status === 'complete') {
        validatedExecution = serializeNotebookAiExecution(
          request.state.execution,
        )
        validationError = ''
      } else {
        validatedExecution = ''
        validationError = result.diagnostic
      }
    }

    if (!completedResult || !sawTerminal) {
      throw new Error('Notebook AI stream ended before the run finished')
    }
    const changedFiles = getChangedNotebookAiFiles(
      baselineExecution.workspace,
      completedResult.execution.workspace,
    )
    const runtimeChanged =
      JSON.stringify(baselineExecution.runtime) !==
      JSON.stringify(completedResult.execution.runtime)
    if (
      (changedFiles.length > 0 || runtimeChanged) &&
      validatedExecution !==
        serializeNotebookAiExecution(completedResult.execution)
    ) {
      throw new Error(
        validationError ||
          'Codex finished without validating its notebook changes.',
      )
    }

    return { ...completedResult, changedFiles, runtimeChanged }
  }

  async function runValidatedStream(
    validate: (
      state: NotebookAiValidationState,
    ) => Promise<NotebookAiStreamValidationOutcome>,
  ) {
    const baselineExecution = parseNotebookAiExecution(forwardedProps.execution)
    const activeForwardedProps = { ...forwardedProps }
    let resolveValidationState:
      | ((state: NotebookAiValidationState) => void)
      | undefined
    let rejectValidationState: ((error: Error) => void) | undefined
    let validationStatePromise = createValidationStatePromise()
    let validationPromise:
      | Promise<NotebookAiStreamValidationOutcome>
      | undefined
    let receivedValidationState = false
    let validatedExecution = ''
    let validationError = ''
    const tools = clientTools(
      validateNotebookAiTool.client(async () => {
        validationPromise ??= validationStatePromise.then(async (state) => {
          const outcome = await validate(state)
          const result = parseNotebookAiValidationResult(outcome.result)
          activeForwardedProps.execution = state.execution
          if (outcome.repair) {
            activeForwardedProps.repair = outcome.repair
          } else {
            delete activeForwardedProps.repair
          }
          updateClientForwardedProps(activeForwardedProps)

          if (result.status === 'complete') {
            validatedExecution = serializeNotebookAiExecution(state.execution)
            validationError = ''
          } else {
            validatedExecution = ''
            validationError = result.diagnostic
          }
          return { ...outcome, result }
        })
        return (await validationPromise).result
      }),
    )
    const client = new ChatClient({
      connection,
      initialMessages: toUiMessages(messages, runId),
      threadId,
      forwardedProps: activeForwardedProps,
      tools,
      onChunk: (chunk) => {
        observeProtocolChunk(chunk, true)

        if (chunk.type === 'RUN_STARTED') {
          validationStatePromise = createValidationStatePromise()
          validationPromise = undefined
          receivedValidationState = false
          return
        }
        if (chunk.type === 'STATE_SNAPSHOT') {
          const state = parseNotebookAiValidationState(chunk.snapshot)
          receivedValidationState = true
          resolveValidationState?.(state)
          return
        }
        if (
          chunk.type === 'RUN_FINISHED' &&
          chunk.outcome?.type === 'interrupt' &&
          !receivedValidationState
        ) {
          rejectValidationState?.(
            new Error('Notebook AI returned no validation state'),
          )
        }
        if (chunk.type === 'RUN_ERROR') {
          rejectValidationState?.(new Error(chunk.message))
        }
      },
    })
    const updateClientForwardedProps = (
      nextForwardedProps: Record<string, unknown>,
    ) => client.updateOptions({ forwardedProps: nextForwardedProps })
    const abort = () => client.stop()
    signal.addEventListener('abort', abort, { once: true })

    try {
      if (signal.aborted) abort()
      else await client.reload()
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const streamError = client.getError()
      if (streamError) throw streamError
      if (!completedResult || !sawTerminal) {
        throw new Error('Notebook AI stream ended before the run finished')
      }

      const changedFiles = getChangedNotebookAiFiles(
        baselineExecution.workspace,
        completedResult.execution.workspace,
      )
      const runtimeChanged =
        JSON.stringify(baselineExecution.runtime) !==
        JSON.stringify(completedResult.execution.runtime)
      if (
        (changedFiles.length > 0 || runtimeChanged) &&
        validatedExecution !==
          serializeNotebookAiExecution(completedResult.execution)
      ) {
        throw new Error(
          validationError ||
            'The assistant finished without validating its notebook changes.',
        )
      }

      return { ...completedResult, changedFiles, runtimeChanged }
    } finally {
      signal.removeEventListener('abort', abort)
      client.dispose()
    }

    function createValidationStatePromise() {
      return new Promise<NotebookAiValidationState>((resolve, reject) => {
        resolveValidationState = resolve
        rejectValidationState = reject
      })
    }
  }

  async function submitLocalValidation(value: unknown) {
    const response = await fetch(notebookAiLocalValidationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
      signal,
    })
    if (response.ok) return

    const result: unknown = await response.json().catch(() => undefined)
    throw new Error(
      isRecord(result) && typeof result.error === 'string'
        ? result.error
        : `Notebook validation failed (${response.status})`,
    )
  }

  function observeProtocolChunk(chunk: StreamChunk, allowInterrupt: boolean) {
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
    if (chunk.type !== 'RUN_FINISHED') return
    if (chunk.finishReason === 'tool_calls') {
      if (pendingResult) {
        throw new Error('Notebook AI returned a partial execution result')
      }
      return
    }
    if (chunk.outcome?.type === 'interrupt') {
      if (allowInterrupt) return
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
