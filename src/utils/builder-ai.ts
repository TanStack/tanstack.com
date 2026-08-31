import { EventType, type StreamChunk } from '@tanstack/ai'
import { isExampleRuntime } from './example-project'
import {
  parseExampleWorkspace,
  serializeExampleWorkspace,
  type ExampleRuntime,
  type ExampleWorkspace,
} from './example-workspace'
import {
  parseBuilderAiAttemptTrace,
  type BuilderAiAttemptTrace,
} from './builder-ai-progress'

export const builderAiRemoteProviders = ['openai', 'anthropic'] as const

export type BuilderAiRemoteProvider = (typeof builderAiRemoteProviders)[number]

export type BuilderAiRemoteModel = {
  provider: BuilderAiRemoteProvider
  model: string
  label: string
  description: string
}

export const builderAiOpenAiDefaultModel = {
  provider: 'openai',
  model: 'gpt-5.6-luna',
  label: 'GPT-5.6 Luna',
  description: 'Efficient',
} satisfies BuilderAiRemoteModel

export const builderAiAnthropicDefaultModel = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  label: 'Claude Sonnet 4.6',
  description: 'Balanced',
} satisfies BuilderAiRemoteModel

export const builderAiRemoteModels: ReadonlyArray<BuilderAiRemoteModel> = [
  {
    provider: 'openai',
    model: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    description: 'Frontier',
  },
  {
    provider: 'openai',
    model: 'gpt-5.6-terra',
    label: 'GPT-5.6 Terra',
    description: 'Balanced',
  },
  builderAiOpenAiDefaultModel,
  {
    provider: 'openai',
    model: 'gpt-5.4-mini',
    label: 'GPT-5.4 mini',
    description: 'Budget',
  },
  builderAiAnthropicDefaultModel,
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    description: 'Fast',
  },
]

export const builderAiDefaultRemoteModels = {
  openai: builderAiOpenAiDefaultModel,
  anthropic: builderAiAnthropicDefaultModel,
} satisfies Record<BuilderAiRemoteProvider, BuilderAiRemoteModel>

export function findBuilderAiRemoteModel(
  provider: BuilderAiRemoteProvider,
  model: string,
) {
  return builderAiRemoteModels.find(
    (candidate) => candidate.provider === provider && candidate.model === model,
  )
}

export type BuilderAiMessage = {
  role: 'assistant' | 'user'
  content: string
}

export type BuilderAiExecution = {
  runtime: ExampleRuntime | null
  workspace: ExampleWorkspace
}

export type BuilderAiResponse = {
  message: string
  execution: BuilderAiExecution
  changedFiles: Array<string>
  runtimeChanged: boolean
  trace: BuilderAiAttemptTrace
}

export async function collectBuilderAiMessage(
  stream: AsyncIterable<StreamChunk>,
) {
  let message = ''

  for await (const chunk of stream) {
    if (chunk.type === 'TEXT_MESSAGE_CONTENT') message += chunk.delta
    if (chunk.type === 'RUN_ERROR') throw new Error(chunk.message)
  }

  return message
}

export async function* streamBuilderAiResponse(
  stream: AsyncIterable<StreamChunk>,
  apiKey: string,
  createResponse: (message: string) => BuilderAiResponse,
): AsyncGenerator<StreamChunk> {
  let message = ''
  let messageId = ''
  let sawTerminal = false

  try {
    for await (const chunk of stream) {
      if (chunk.type === 'TEXT_MESSAGE_START') {
        messageId = chunk.messageId
        message = ''
      }
      if (chunk.type === 'TEXT_MESSAGE_CONTENT') {
        if (messageId && messageId !== chunk.messageId) message = ''
        messageId = chunk.messageId
        message += chunk.delta
      }

      if (chunk.type === 'RUN_ERROR') {
        sawTerminal = true
        const { rawEvent, ...safeChunk } = chunk
        void rawEvent
        const redactedMessage = redactBuilderAiKey(chunk.message, apiKey)
        yield {
          ...safeChunk,
          message: redactedMessage,
          ...(chunk.error
            ? {
                error: {
                  ...chunk.error,
                  message: redactBuilderAiKey(chunk.error.message, apiKey),
                },
              }
            : {}),
        }
        continue
      }

      if (
        chunk.type === 'RUN_FINISHED' &&
        chunk.finishReason !== 'tool_calls' &&
        chunk.outcome?.type !== 'interrupt'
      ) {
        yield {
          type: 'CUSTOM',
          name: 'builder.project.execution',
          value: createResponse(message.trim() || 'Builder changes are ready.'),
        }
      }

      if (
        chunk.type === 'RUN_FINISHED' &&
        (chunk.finishReason !== 'tool_calls' ||
          chunk.outcome?.type === 'interrupt')
      ) {
        sawTerminal = true
      }

      yield chunk
    }
    if (!sawTerminal) {
      yield {
        type: EventType.RUN_ERROR,
        message: 'Builder AI provider stream ended before the run finished',
      }
    }
  } catch (error) {
    const redactedError = new Error(
      redactBuilderAiKey(formatError(error), apiKey),
    )
    if (error instanceof Error) redactedError.name = error.name
    throw redactedError
  }
}

export function parseBuilderAiResponse(value: unknown): BuilderAiResponse {
  if (
    !isRecord(value) ||
    typeof value.message !== 'string' ||
    !Array.isArray(value.changedFiles) ||
    !value.changedFiles.every((path) => typeof path === 'string') ||
    typeof value.runtimeChanged !== 'boolean' ||
    !hasOnlyKeys(value, [
      'message',
      'execution',
      'changedFiles',
      'runtimeChanged',
      'trace',
    ])
  ) {
    throw new Error('Builder AI returned an invalid response')
  }

  return {
    message: value.message,
    execution: parseBuilderAiExecution(value.execution),
    changedFiles: value.changedFiles,
    runtimeChanged: value.runtimeChanged,
    trace: parseBuilderAiAttemptTrace(value.trace),
  }
}

export function parseBuilderAiExecution(value: unknown): BuilderAiExecution {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['runtime', 'workspace']) ||
    (value.runtime !== null && !isExampleRuntime(value.runtime))
  ) {
    throw new Error('Builder AI returned an invalid execution')
  }

  return {
    runtime: value.runtime,
    workspace: parseExampleWorkspace(value.workspace),
  }
}

export function serializeBuilderAiExecution(execution: BuilderAiExecution) {
  return JSON.stringify({
    runtime: execution.runtime,
    workspace: JSON.parse(serializeExampleWorkspace(execution.workspace)),
  })
}

export function cloneBuilderAiExecution(execution: BuilderAiExecution) {
  return parseBuilderAiExecution(
    JSON.parse(serializeBuilderAiExecution(execution)),
  )
}

export function redactBuilderAiKey(message: string, apiKey: string) {
  return apiKey ? message.split(apiKey).join('[redacted]') : message
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
