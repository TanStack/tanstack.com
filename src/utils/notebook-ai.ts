import type { StreamChunk } from '@tanstack/ai'
import { isExampleRuntime } from './example-project'
import {
  parseExampleWorkspace,
  serializeExampleWorkspace,
  type ExampleRuntime,
  type ExampleWorkspace,
} from './example-workspace'

export const notebookAiRemoteProviders = ['openai', 'anthropic'] as const

export type NotebookAiRemoteProvider =
  (typeof notebookAiRemoteProviders)[number]

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
    typeof value.runtimeChanged !== 'boolean'
  ) {
    throw new Error('Notebook AI returned an invalid response')
  }

  return {
    message: value.message,
    execution: parseNotebookAiExecution(value.execution),
    changedFiles: value.changedFiles,
    runtimeChanged: value.runtimeChanged,
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
