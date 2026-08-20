import type { StreamChunk } from '@tanstack/ai'
import {
  ChatClient,
  clientTools,
  fetchServerSentEvents,
  type UIMessage,
} from '@tanstack/ai-client'
import type { ByokClient } from '@tanstack/ai-client/byok'
import {
  parseBuilderAiResponse,
  parseBuilderAiExecution,
  serializeBuilderAiExecution,
  type BuilderAiMessage,
  type BuilderAiRemoteProvider,
  type BuilderAiResponse,
} from './builder-ai'
import type {
  BuilderAiActivityEvent,
  BuilderAiActivitySource,
} from './builder-ai-activity'
import type { BuilderAiRepairContext } from './builder-ai-progress'
import {
  builderAiLocalValidationEndpoint,
  builderAiLocalValidationEvent,
  parseBuilderAiLocalValidationRequest,
} from './builder-ai-local-validation'
import {
  parseBuilderAiValidationResult,
  parseBuilderAiValidationState,
  validateBuilderAiTool,
  type BuilderAiValidationState,
} from './builder-ai-validation'
import { getChangedBuilderAiFiles } from './builder-ai-workspace'

export type BuilderAiStreamValidationOutcome = {
  result: ReturnType<typeof parseBuilderAiValidationResult>
  repair?: BuilderAiRepairContext
}

export async function runBuilderAiStream({
  endpoint,
  forwardedProps,
  messages,
  signal,
  threadId,
  activityId,
  byok,
  byokProvider,
  includeReasoningSummaries = false,
  onActivityEvent,
  onText,
  onLocalValidate,
  onValidate,
}: {
  endpoint: string
  forwardedProps: Record<string, unknown>
  messages: ReadonlyArray<BuilderAiMessage & { id?: string }>
  signal: AbortSignal
  threadId: string
  activityId: string
  byok?: ByokClient
  byokProvider?: BuilderAiRemoteProvider
  includeReasoningSummaries?: boolean
  onActivityEvent?: (event: BuilderAiActivityEvent) => void
  onText?: (text: string) => void
  onLocalValidate?: (
    state: BuilderAiValidationState,
  ) => Promise<BuilderAiStreamValidationOutcome>
  onValidate?: (
    state: BuilderAiValidationState,
  ) => Promise<BuilderAiStreamValidationOutcome>
}): Promise<BuilderAiResponse> {
  const runId = crypto.randomUUID()
  const connection = fetchServerSentEvents(endpoint)
  const toolArguments = new Map<string, string>()
  const toolNames = new Map<string, string>()
  const reasoning = new Map<string, string>()
  let pendingResult: BuilderAiResponse | undefined
  let completedResult: BuilderAiResponse | undefined
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
    throw new Error('Builder AI cannot use two validation transports')
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
    await getDirectRunContext(),
  )) {
    observeProtocolChunk(chunk, false)
  }

  if (!completedResult || !sawTerminal) {
    throw new Error('Builder AI stream ended before the run finished')
  }
  return completedResult

  async function runLocallyValidatedStream(
    validate: (
      state: BuilderAiValidationState,
    ) => Promise<BuilderAiStreamValidationOutcome>,
  ) {
    const baselineExecution = parseBuilderAiExecution(forwardedProps.execution)
    let validatedExecution = ''
    let validationError = ''

    for await (const chunk of connection.connect(
      toUiMessages(messages, runId),
      undefined,
      signal,
      await getDirectRunContext(),
    )) {
      observeProtocolChunk(chunk, false)
      if (
        chunk.type !== 'CUSTOM' ||
        chunk.name !== builderAiLocalValidationEvent
      ) {
        continue
      }

      const request = parseBuilderAiLocalValidationRequest(chunk.value)
      const outcome = await validate(request.state)
      const result = parseBuilderAiValidationResult(outcome.result)
      await submitLocalValidation({
        requestId: request.requestId,
        result,
        ...(outcome.repair ? { repair: outcome.repair } : {}),
      })
      if (result.status === 'complete') {
        validatedExecution = serializeBuilderAiExecution(
          request.state.execution,
        )
        validationError = ''
      } else {
        validatedExecution = ''
        validationError = result.diagnostic
      }
    }

    if (!completedResult || !sawTerminal) {
      throw new Error('Builder AI stream ended before the run finished')
    }
    const changedFiles = getChangedBuilderAiFiles(
      baselineExecution.workspace,
      completedResult.execution.workspace,
    )
    const runtimeChanged =
      JSON.stringify(baselineExecution.runtime) !==
      JSON.stringify(completedResult.execution.runtime)
    if (
      (changedFiles.length > 0 || runtimeChanged) &&
      validatedExecution !==
        serializeBuilderAiExecution(completedResult.execution)
    ) {
      throw new Error(
        validationError ||
          'Codex finished without validating its builder changes.',
      )
    }

    return { ...completedResult, changedFiles, runtimeChanged }
  }

  async function runValidatedStream(
    validate: (
      state: BuilderAiValidationState,
    ) => Promise<BuilderAiStreamValidationOutcome>,
  ) {
    const baselineExecution = parseBuilderAiExecution(forwardedProps.execution)
    const activeForwardedProps = { ...forwardedProps }
    let resolveValidationState:
      | ((state: BuilderAiValidationState) => void)
      | undefined
    let rejectValidationState: ((error: Error) => void) | undefined
    let validationStatePromise = createValidationStatePromise()
    let validationPromise: Promise<BuilderAiStreamValidationOutcome> | undefined
    let receivedValidationState = false
    let validatedExecution = ''
    let validationError = ''
    const tools = clientTools(
      validateBuilderAiTool.client(async () => {
        validationPromise ??= validationStatePromise.then(async (state) => {
          const outcome = await validate(state)
          const result = parseBuilderAiValidationResult(outcome.result)
          activeForwardedProps.execution = state.execution
          if (outcome.repair) {
            activeForwardedProps.repair = outcome.repair
          } else {
            delete activeForwardedProps.repair
          }
          updateClientForwardedProps(activeForwardedProps)

          if (result.status === 'complete') {
            validatedExecution = serializeBuilderAiExecution(state.execution)
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
      byok,
      byokProvider: byokProvider ? () => byokProvider : undefined,
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
          const state = parseBuilderAiValidationState(chunk.snapshot)
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
            new Error('Builder AI returned no validation state'),
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
        throw new Error('Builder AI stream ended before the run finished')
      }

      const changedFiles = getChangedBuilderAiFiles(
        baselineExecution.workspace,
        completedResult.execution.workspace,
      )
      const runtimeChanged =
        JSON.stringify(baselineExecution.runtime) !==
        JSON.stringify(completedResult.execution.runtime)
      if (
        (changedFiles.length > 0 || runtimeChanged) &&
        validatedExecution !==
          serializeBuilderAiExecution(completedResult.execution)
      ) {
        throw new Error(
          validationError ||
            'The assistant finished without validating its builder changes.',
        )
      }

      return { ...completedResult, changedFiles, runtimeChanged }
    } finally {
      signal.removeEventListener('abort', abort)
      client.dispose()
    }

    function createValidationStatePromise() {
      return new Promise<BuilderAiValidationState>((resolve, reject) => {
        resolveValidationState = resolve
        rejectValidationState = reject
      })
    }
  }

  async function getDirectRunContext() {
    const context = { threadId, runId, forwardedProps }
    if (!byok) return context
    if (!byokProvider) {
      throw new Error('Builder AI BYOK requests require a provider')
    }
    await byok.prepare(byokProvider)
    return { ...context, headers: byok.headers(byokProvider) }
  }

  async function submitLocalValidation(value: unknown) {
    const response = await fetch(builderAiLocalValidationEndpoint, {
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
        : `Builder validation failed (${response.status})`,
    )
  }

  function observeProtocolChunk(chunk: StreamChunk, allowInterrupt: boolean) {
    if (sawTerminal) {
      throw new Error('Builder AI returned events after the run finished')
    }
    if (
      expectingTerminal &&
      chunk.type !== 'RUN_FINISHED' &&
      chunk.type !== 'RUN_ERROR'
    ) {
      throw new Error('Builder AI returned an invalid execution result')
    }

    observeTextChunk(chunk)
    observeActivityChunk(chunk)

    if (chunk.type === 'CUSTOM' && chunk.name === 'builder.project.execution') {
      if (pendingResult || completedResult) {
        throw new Error('Builder AI returned duplicate execution results')
      }
      pendingResult = parseBuilderAiResponse(chunk.value)
      expectingTerminal = true
    }
    if (chunk.type === 'RUN_ERROR') throw new Error(chunk.message)
    if (chunk.type !== 'RUN_FINISHED') return
    if (chunk.finishReason === 'tool_calls') {
      if (pendingResult) {
        throw new Error('Builder AI returned a partial execution result')
      }
      return
    }
    if (chunk.outcome?.type === 'interrupt') {
      if (allowInterrupt) return
      throw new Error('Builder AI was interrupted')
    }
    if (!pendingResult) {
      throw new Error('Builder AI returned no execution result')
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
      const argumentsText = `${
        toolArguments.get(chunk.toolCallId) ?? ''
      }${chunk.delta}`
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
      const name = toolNames.get(chunk.toolCallId) ?? 'tool'
      toolNames.set(chunk.toolCallId, name)
      const input =
        chunk.input ?? parseJson(toolArguments.get(chunk.toolCallId))
      emitItem('item-running', chunk.toolCallId, name, timestamp, input)
      return
    }

    if (chunk.type === 'TOOL_CALL_RESULT') {
      const name = toolNames.get(chunk.toolCallId) ?? 'tool'
      if (isToolCallResultError(chunk)) {
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
    const source: BuilderAiActivitySource =
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
  messages: ReadonlyArray<BuilderAiMessage & { id?: string }>,
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

function isToolCallResultError(
  chunk: Extract<StreamChunk, { type: 'TOOL_CALL_RESULT' }>,
) {
  if (chunk.state === 'output-error') return true
  if (!isRecord(chunk.metadata)) return false
  const tanstack = chunk.metadata.tanstack
  return isRecord(tanstack) && tanstack.state === 'output-error'
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
  return typeof parsed === 'string' ? parsed : 'Builder tool failed'
}
