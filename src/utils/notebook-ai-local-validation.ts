import type { NotebookAiRepairContext } from './notebook-ai-progress'
import { parseNotebookAiRepairContext } from './notebook-ai-progress'
import {
  parseNotebookAiValidationResult,
  parseNotebookAiValidationState,
  type NotebookAiValidationState,
} from './notebook-ai-validation'

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export const notebookAiLocalValidationEvent = 'notebook.validation.request'
export const notebookAiLocalValidationEndpoint =
  '/api/notebook/chatgpt/validation'

export type NotebookAiLocalValidationRequest = {
  requestId: string
  state: NotebookAiValidationState
}

export type NotebookAiLocalValidationSubmission = {
  requestId: string
  result: ReturnType<typeof parseNotebookAiValidationResult>
  repair?: NotebookAiRepairContext
}

export function parseNotebookAiLocalValidationRequest(
  value: unknown,
): NotebookAiLocalValidationRequest {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['requestId', 'state']) ||
    !isRequestId(value.requestId)
  ) {
    throw new Error('Invalid local notebook validation request')
  }

  return {
    requestId: value.requestId,
    state: parseNotebookAiValidationState(value.state),
  }
}

export function parseNotebookAiLocalValidationSubmission(
  value: unknown,
): NotebookAiLocalValidationSubmission {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['requestId', 'result', 'repair']) ||
    !isRequestId(value.requestId)
  ) {
    throw new Error('Invalid local notebook validation result')
  }

  const result = parseNotebookAiValidationResult(value.result)
  const repair = parseNotebookAiRepairContext(value.repair)
  if (
    (result.status === 'repair' && repair === undefined) ||
    (result.status !== 'repair' && repair !== undefined)
  ) {
    throw new Error('Invalid local notebook validation result')
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
