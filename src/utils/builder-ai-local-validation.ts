import type { BuilderAiRepairContext } from './builder-ai-progress'
import { parseBuilderAiRepairContext } from './builder-ai-progress'
import {
  parseBuilderAiValidationResult,
  parseBuilderAiValidationState,
  type BuilderAiValidationState,
} from './builder-ai-validation'

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export const builderAiLocalValidationEvent =
  'builder.project.validation.request'
export const builderAiLocalValidationEndpoint =
  '/api/builder/chatgpt/validation'

export type BuilderAiLocalValidationRequest = {
  requestId: string
  state: BuilderAiValidationState
}

export type BuilderAiLocalValidationSubmission = {
  requestId: string
  result: ReturnType<typeof parseBuilderAiValidationResult>
  repair?: BuilderAiRepairContext
}

export function parseBuilderAiLocalValidationRequest(
  value: unknown,
): BuilderAiLocalValidationRequest {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['requestId', 'state']) ||
    !isRequestId(value.requestId)
  ) {
    throw new Error('Invalid local builder validation request')
  }

  return {
    requestId: value.requestId,
    state: parseBuilderAiValidationState(value.state),
  }
}

export function parseBuilderAiLocalValidationSubmission(
  value: unknown,
): BuilderAiLocalValidationSubmission {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['requestId', 'result', 'repair']) ||
    !isRequestId(value.requestId)
  ) {
    throw new Error('Invalid local builder validation result')
  }

  const result = parseBuilderAiValidationResult(value.result)
  const repair = parseBuilderAiRepairContext(value.repair)
  if (
    (result.status === 'repair' && repair === undefined) ||
    (result.status !== 'repair' && repair !== undefined)
  ) {
    throw new Error('Invalid local builder validation result')
  }

  return {
    requestId: value.requestId,
    result,
    ...(repair ? { repair } : {}),
  }
}

function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && requestIdPattern.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
