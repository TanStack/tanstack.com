import type { StreamChunk } from '@tanstack/ai'
import { isExampleRuntime } from './example-project'
import {
  parseExampleWorkspace,
  serializeExampleWorkspace,
  type ExampleRuntime,
  type ExampleWorkspace,
} from './example-workspace'
import {
  parseNotebookAiAttemptTrace,
  type NotebookAiAttemptTrace,
} from './notebook-ai-progress'

export const notebookAiRemoteProviders = ['openai', 'anthropic'] as const

export type NotebookAiRemoteProvider =
  (typeof notebookAiRemoteProviders)[number]

export type NotebookAiRemoteModel = {
  provider: NotebookAiRemoteProvider
  model: string
  label: string
  description: string
}

export const notebookAiOpenAiDefaultModel = {
  provider: 'openai',
  model: 'gpt-5.6-luna',
  label: 'GPT-5.6 Luna',
  description: 'Efficient',
} satisfies NotebookAiRemoteModel

export const notebookAiAnthropicDefaultModel = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  label: 'Claude Sonnet 4.6',
  description: 'Balanced',
} satisfies NotebookAiRemoteModel

export const notebookAiRemoteModels: ReadonlyArray<NotebookAiRemoteModel> = [
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
  notebookAiOpenAiDefaultModel,
  {
    provider: 'openai',
    model: 'gpt-5.4-mini',
    label: 'GPT-5.4 mini',
    description: 'Budget',
  },
  notebookAiAnthropicDefaultModel,
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    description: 'Fast',
  },
]

export const notebookAiDefaultRemoteModels = {
  openai: notebookAiOpenAiDefaultModel,
  anthropic: notebookAiAnthropicDefaultModel,
} satisfies Record<NotebookAiRemoteProvider, NotebookAiRemoteModel>

export function findNotebookAiRemoteModel(
  provider: NotebookAiRemoteProvider,
  model: string,
) {
  return notebookAiRemoteModels.find(
    (candidate) => candidate.provider === provider && candidate.model === model,
  )
}

export type NotebookAiMessage = {
  role: 'assistant' | 'user'
  content: string
}

export type NotebookAiExecution = {
  runtime: ExampleRuntime | null
  workspace: ExampleWorkspace
}

export type NotebookAiResponse = {
  message: string
  execution: NotebookAiExecution
  changedFiles: Array<string>
  runtimeChanged: boolean
  trace: NotebookAiAttemptTrace
}

export async function collectNotebookAiMessage(
  stream: AsyncIterable<StreamChunk>,
) {
  let message = ''

  for await (const chunk of stream) {
    if (chunk.type === 'TEXT_MESSAGE_CONTENT') message += chunk.delta
    if (chunk.type === 'RUN_ERROR') throw new Error(chunk.message)
  }

  return message
}

export async function* streamNotebookAiResponse(
  stream: AsyncIterable<StreamChunk>,
  apiKey: string,
  createResponse: (message: string) => NotebookAiResponse,
): AsyncGenerator<StreamChunk> {
  let message = ''
  let messageId = ''

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
        const { rawEvent, ...safeChunk } = chunk
        void rawEvent
        const redactedMessage = redactNotebookAiKey(chunk.message, apiKey)
        yield {
          ...safeChunk,
          message: redactedMessage,
          ...(chunk.error
            ? {
                error: {
                  ...chunk.error,
                  message: redactNotebookAiKey(chunk.error.message, apiKey),
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
          name: 'notebook.execution',
          value: createResponse(
            message.trim() || 'Notebook changes are ready.',
          ),
        }
      }

      yield chunk
    }
  } catch (error) {
    const redactedError = new Error(
      redactNotebookAiKey(formatError(error), apiKey),
    )
    if (error instanceof Error) redactedError.name = error.name
    throw redactedError
  }
}

export function parseNotebookAiResponse(value: unknown): NotebookAiResponse {
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
    throw new Error('Notebook AI returned an invalid response')
  }

  return {
    message: value.message,
    execution: parseNotebookAiExecution(value.execution),
    changedFiles: value.changedFiles,
    runtimeChanged: value.runtimeChanged,
    trace: parseNotebookAiAttemptTrace(value.trace),
  }
}

export function parseNotebookAiExecution(value: unknown): NotebookAiExecution {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['runtime', 'workspace']) ||
    (value.runtime !== null && !isExampleRuntime(value.runtime))
  ) {
    throw new Error('Notebook AI returned an invalid execution')
  }

  return {
    runtime: value.runtime,
    workspace: parseExampleWorkspace(value.workspace),
  }
}

export function serializeNotebookAiExecution(execution: NotebookAiExecution) {
  return JSON.stringify({
    runtime: execution.runtime,
    workspace: JSON.parse(serializeExampleWorkspace(execution.workspace)),
  })
}

export function cloneNotebookAiExecution(execution: NotebookAiExecution) {
  return parseNotebookAiExecution(
    JSON.parse(serializeNotebookAiExecution(execution)),
  )
}

export function redactNotebookAiKey(message: string, apiKey: string) {
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
