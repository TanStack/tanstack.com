import { chatParamsFromRequestBody } from '@tanstack/ai'
import { byokMissing, getByokKey } from '@tanstack/ai/byok/server'
import { anthropicByok } from '@tanstack/ai-anthropic/byok'
import { openaiByok } from '@tanstack/ai-openai/byok'
import { openrouterByok } from '@tanstack/ai-openrouter/byok'
import {
  parseBuilderAiExecution,
  type BuilderAiExecution,
  type BuilderAiRemoteProvider,
} from './builder-ai'
import {
  parseBuilderAiRepairContext,
  type BuilderAiRepairContext,
} from './builder-ai-progress'
import {
  isBuilderAiValidationClientTools,
  builderAiValidationResultSchema,
} from './builder-ai-validation'

const maxMessages = 20
const maxWireMessages = maxMessages * 16
const maxMessageCharacters = 10_000
const maxToolResultCharacters = 400_000
const toolCallStates = new Set([
  'awaiting-input',
  'input-streaming',
  'input-complete',
  'approval-requested',
  'approval-responded',
  'complete',
  'error',
])
const toolResultStates = new Set(['streaming', 'complete', 'error'])

export type BuilderAiRequest = {
  provider: BuilderAiRemoteProvider
  model: string
  messages: Awaited<ReturnType<typeof chatParamsFromRequestBody>>['messages']
  threadId: string
  runId: string
  parentRunId?: string
  resume?: Awaited<ReturnType<typeof chatParamsFromRequestBody>>['resume']
  clientTools: Awaited<ReturnType<typeof chatParamsFromRequestBody>>['tools']
  execution: BuilderAiExecution
  hiddenFiles: ReadonlyArray<string>
  repair?: BuilderAiRepairContext
}

export async function parseBuilderAiRequest(
  value: unknown,
): Promise<BuilderAiRequest> {
  const params = await chatParamsFromRequestBody(value)
  const forwardedProps = params.forwardedProps

  if (
    !hasOnlyKeys(forwardedProps, [
      'provider',
      'model',
      'execution',
      'hiddenFiles',
      'repair',
    ]) ||
    (forwardedProps.provider !== 'openai' &&
      forwardedProps.provider !== 'anthropic' &&
      forwardedProps.provider !== 'openrouter') ||
    typeof forwardedProps.model !== 'string' ||
    !forwardedProps.model.trim() ||
    !params.threadId ||
    params.threadId.length > 256 ||
    !params.runId ||
    params.runId.length > 256 ||
    (params.parentRunId !== undefined &&
      (!params.parentRunId || params.parentRunId.length > 256)) ||
    !Array.isArray(forwardedProps.hiddenFiles) ||
    !forwardedProps.hiddenFiles.every((path) => typeof path === 'string') ||
    !isBuilderAiValidationClientTools(params.tools) ||
    !isEmptyRecord(params.state) ||
    !isBuilderAiResume(params.parentRunId, params.resume) ||
    !isBuilderAiHistory(params.messages, params.resume !== undefined)
  ) {
    throw new Error('Invalid builder AI request')
  }

  const execution = parseBuilderAiExecution(forwardedProps.execution)
  const repair = parseBuilderAiRepairContext(forwardedProps.repair)
  const workspace = execution.workspace
  if (
    forwardedProps.hiddenFiles.some(
      (path) => workspace.files[path] === undefined,
    )
  ) {
    throw new Error('Invalid hidden builder file')
  }

  return {
    provider: forwardedProps.provider,
    model: forwardedProps.model,
    messages: params.messages,
    threadId: params.threadId,
    runId: params.runId,
    ...(params.parentRunId ? { parentRunId: params.parentRunId } : {}),
    ...(params.resume ? { resume: params.resume } : {}),
    clientTools: params.tools,
    execution,
    hiddenFiles: forwardedProps.hiddenFiles,
    ...(repair ? { repair } : {}),
  }
}

export function getBuilderAiApiKey(
  request: Request,
  provider: BuilderAiRemoteProvider,
) {
  if (provider === 'openrouter') return getByokKey(request, openrouterByok.id)
  return provider === 'openai'
    ? getByokKey(request, openaiByok.id)
    : getByokKey(request, anthropicByok.id)
}

export function getBuilderAiMissingKeyResponse(
  provider: BuilderAiRemoteProvider,
) {
  if (provider === 'openrouter') return byokMissing(openrouterByok)
  return provider === 'openai'
    ? byokMissing(openaiByok)
    : byokMissing(anthropicByok)
}

function isBuilderAiResume(
  parentRunId: string | undefined,
  resume: Awaited<ReturnType<typeof chatParamsFromRequestBody>>['resume'],
) {
  if (resume === undefined) return parentRunId === undefined
  if (!parentRunId || resume.length === 0 || resume.length > 4) return false

  return resume.every((entry) => {
    if (
      !entry.interruptId.startsWith('client_tool_') ||
      entry.interruptId.length > 512
    ) {
      return false
    }
    if (entry.status === 'cancelled') return entry.payload === undefined
    return (
      entry.status === 'resolved' &&
      builderAiValidationResultSchema.safeParse(entry.payload).success
    )
  })
}

function isEmptyRecord(value: unknown) {
  return isRecord(value) && Object.keys(value).length === 0
}

function isBuilderAiHistory(
  messages: ReadonlyArray<unknown>,
  isResume: boolean,
) {
  if (messages.length === 0 || messages.length > maxWireMessages) return false

  const messageLimit = isResume ? maxWireMessages : maxMessages
  let messageCount = 0
  let lastRole: 'assistant' | 'user' | undefined

  for (const message of messages) {
    if (!isRecord(message) || typeof message.role !== 'string') return false

    if (message.role === 'tool') {
      if (
        typeof message.toolCallId !== 'string' ||
        !message.toolCallId ||
        typeof message.content !== 'string' ||
        message.content.length > maxToolResultCharacters
      ) {
        return false
      }
      continue
    }

    if (message.role === 'reasoning') {
      if (
        typeof message.content !== 'string' ||
        message.content.length > maxMessageCharacters
      ) {
        return false
      }
      continue
    }

    if (message.role !== 'assistant' && message.role !== 'user') return false

    const valid = Array.isArray(message.parts)
      ? isBuilderAiMessageParts(message.role, message.parts)
      : isBuilderAiWireMessage(message.role, message)
    if (!valid) return false

    messageCount += 1
    lastRole = message.role
  }

  return (
    messageCount > 0 &&
    messageCount <= messageLimit &&
    (lastRole === 'user' || (isResume && lastRole === 'assistant'))
  )
}

function isBuilderAiMessageParts(
  role: 'assistant' | 'user',
  parts: ReadonlyArray<unknown>,
) {
  let textCharacters = 0
  let hasContent = false

  for (const part of parts) {
    if (!isRecord(part) || typeof part.type !== 'string') return false

    if (part.type === 'text') {
      if (typeof part.content !== 'string') return false
      textCharacters += part.content.length
      hasContent ||= part.content.trim().length > 0
      continue
    }

    if (role === 'user') return false

    if (part.type === 'thinking') {
      if (
        typeof part.content !== 'string' ||
        part.content.length > maxMessageCharacters
      ) {
        return false
      }
      hasContent ||= part.content.trim().length > 0
      continue
    }

    if (part.type === 'tool-call') {
      if (
        typeof part.id !== 'string' ||
        !part.id ||
        typeof part.name !== 'string' ||
        !part.name ||
        typeof part.arguments !== 'string' ||
        part.arguments.length > maxToolResultCharacters ||
        typeof part.state !== 'string' ||
        !toolCallStates.has(part.state)
      ) {
        return false
      }
      hasContent = true
      continue
    }

    if (part.type === 'tool-result') {
      if (
        typeof part.toolCallId !== 'string' ||
        !part.toolCallId ||
        typeof part.content !== 'string' ||
        part.content.length > maxToolResultCharacters ||
        typeof part.state !== 'string' ||
        !toolResultStates.has(part.state)
      ) {
        return false
      }
      hasContent = true
      continue
    }

    return false
  }

  return (
    textCharacters <= maxMessageCharacters &&
    hasContent &&
    (role === 'assistant' || textCharacters > 0)
  )
}

function isBuilderAiWireMessage(
  role: 'assistant' | 'user',
  message: Record<string, unknown>,
) {
  if (role === 'user') {
    return (
      typeof message.content === 'string' &&
      message.content.trim().length > 0 &&
      message.content.length <= maxMessageCharacters
    )
  }

  if (typeof message.content === 'string') {
    return (
      message.content.trim().length > 0 &&
      message.content.length <= maxMessageCharacters
    )
  }

  return isBuilderAiToolCalls(message.toolCalls)
}

function isBuilderAiToolCalls(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return false

  return value.every(
    (toolCall) =>
      isRecord(toolCall) &&
      typeof toolCall.id === 'string' &&
      Boolean(toolCall.id) &&
      toolCall.type === 'function' &&
      isRecord(toolCall.function) &&
      typeof toolCall.function.name === 'string' &&
      Boolean(toolCall.function.name) &&
      typeof toolCall.function.arguments === 'string' &&
      toolCall.function.arguments.length <= maxToolResultCharacters,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
