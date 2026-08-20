import { convertSchemaToJsonSchema, toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import {
  parseNotebookAiExecution,
  type NotebookAiExecution,
} from './notebook-ai'
import {
  parseNotebookAiAttemptTrace,
  type NotebookAiAttemptTrace,
} from './notebook-ai-progress'

const validateNotebookInputSchema = z.object({}).strict()

export const notebookAiValidationResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('complete') }).strict(),
  z
    .object({
      status: z.literal('repair'),
      phase: z.enum(['compile', 'runtime']),
      diagnostic: z.string().min(1).max(4_000),
      evidence: z.string().max(16_000),
    })
    .strict(),
  z
    .object({
      status: z.literal('stop'),
      preserveCurrentExecution: z.boolean(),
      diagnostic: z.string().min(1).max(4_000),
    })
    .strict(),
])

export const validateNotebookAiTool = toolDefinition({
  name: 'validate_notebook',
  description:
    'Compile and run the current notebook in its real browser preview. Call this after every mutation and before finishing. If it requests a repair, gather new evidence, make a materially different fix, and validate again. If it returns stop, do not mutate again.',
  inputSchema: validateNotebookInputSchema,
  outputSchema: notebookAiValidationResultSchema,
})

export type NotebookAiValidationState = {
  execution: NotebookAiExecution
  changedFiles: Array<string>
  runtimeChanged: boolean
  trace: NotebookAiAttemptTrace
}

export function parseNotebookAiValidationResult(value: unknown) {
  const result = notebookAiValidationResultSchema.safeParse(value)
  if (!result.success) {
    throw new Error('Invalid notebook validation result')
  }
  return result.data
}

export function parseNotebookAiValidationState(
  value: unknown,
): NotebookAiValidationState {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'execution',
      'changedFiles',
      'runtimeChanged',
      'trace',
    ]) ||
    value.execution === undefined ||
    !Array.isArray(value.changedFiles) ||
    value.changedFiles.length > 512 ||
    !value.changedFiles.every(
      (path) => typeof path === 'string' && path.length <= 1_024,
    ) ||
    typeof value.runtimeChanged !== 'boolean' ||
    value.trace === undefined
  ) {
    throw new Error('Invalid notebook validation state')
  }

  return {
    execution: parseNotebookAiExecution(value.execution),
    changedFiles: Array.from(new Set(value.changedFiles)),
    runtimeChanged: value.runtimeChanged,
    trace: parseNotebookAiAttemptTrace(value.trace),
  }
}

export function getNotebookAiValidationClientToolDeclaration() {
  return {
    name: validateNotebookAiTool.name,
    description: validateNotebookAiTool.description,
    parameters: convertSchemaToJsonSchema(validateNotebookAiTool.inputSchema),
  }
}

export function isNotebookAiValidationClientTools(
  tools: ReadonlyArray<{
    name: string
    description: string
    parameters: unknown
  }>,
) {
  if (tools.length !== 1) return false
  const expected = getNotebookAiValidationClientToolDeclaration()
  const actual = tools[0]
  return (
    actual !== undefined &&
    actual.name === expected.name &&
    actual.description === expected.description &&
    hasSameJsonValue(actual.parameters, expected.parameters)
  )
}

function hasSameJsonValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => hasSameJsonValue(value, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) && hasSameJsonValue(left[key], right[key]),
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
