import { convertSchemaToJsonSchema, toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import { parseBuilderAiExecution, type BuilderAiExecution } from './builder-ai'
import {
  parseBuilderAiAttemptTrace,
  type BuilderAiAttemptTrace,
} from './builder-ai-progress'

const validateBuilderInputSchema = z.object({}).strict()

export const builderAiValidationResultSchema = z.discriminatedUnion('status', [
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

export const validateBuilderAiTool = toolDefinition({
  name: 'validate_project',
  description:
    'Compile and run the current builder in its real browser preview. Call this after every mutation and before finishing. If it requests a repair, gather new evidence, make a materially different fix, and validate again. If it returns stop, do not mutate again.',
  inputSchema: validateBuilderInputSchema,
  outputSchema: builderAiValidationResultSchema,
})

export type BuilderAiValidationState = {
  execution: BuilderAiExecution
  changedFiles: Array<string>
  runtimeChanged: boolean
  trace: BuilderAiAttemptTrace
}

export function parseBuilderAiValidationResult(value: unknown) {
  const result = builderAiValidationResultSchema.safeParse(value)
  if (!result.success) {
    throw new Error('Invalid builder validation result')
  }
  return result.data
}

export function parseBuilderAiValidationState(
  value: unknown,
): BuilderAiValidationState {
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
    throw new Error('Invalid builder validation state')
  }

  return {
    execution: parseBuilderAiExecution(value.execution),
    changedFiles: Array.from(new Set(value.changedFiles)),
    runtimeChanged: value.runtimeChanged,
    trace: parseBuilderAiAttemptTrace(value.trace),
  }
}

export function getBuilderAiValidationClientToolDeclaration() {
  return {
    name: validateBuilderAiTool.name,
    description: validateBuilderAiTool.description,
    parameters: convertSchemaToJsonSchema(validateBuilderAiTool.inputSchema),
  }
}

export function isBuilderAiValidationClientTools(
  tools: ReadonlyArray<{
    name: string
    description: string
    parameters: unknown
  }>,
) {
  if (tools.length !== 1) return false
  const expected = getBuilderAiValidationClientToolDeclaration()
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
