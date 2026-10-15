import { z } from 'zod'

/** A workflow definition is data, not authorization to run its steps. */
export const workflowStepIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,63}$/, 'Use a lowercase step ID.')

const workflowInputSchema = z.strictObject({
  name: z
    .string()
    .regex(
      /^[a-z][a-z0-9_-]{0,63}$/,
      'The input name must use lowercase letters, digits, underscores or hyphens, starting with a letter, for example report_file. Change inputs[].name, not the step ID.',
    )
    .describe(
      'Lowercase input name, for example report_file. Used by the worker to read predecessor evidence.',
    ),
  fromStep: workflowStepIdSchema,
  // A result is attributed evidence. It cannot provide new tool permissions.
  output: z.enum(['answer', 'files']),
})

export const workflowStepSchema = z.strictObject({
  id: workflowStepIdSchema,
  name: z.string().trim().min(1).max(80),
  objective: z
    .string()
    .trim()
    .min(1)
    .max(12000)
    .describe(
      'Self-contained instructions for an isolated worker that cannot see the authoring conversation. Include the task context, applicable user constraints, allowed or prohibited actions, and exact output requirements. Preserve literal output text as literal text. Dependencies only control order; use named inputs for predecessor evidence.',
    ),
  dependsOn: z.array(workflowStepIdSchema).max(31).default([]),
  inputs: z.array(workflowInputSchema).max(32).default([]),
  // Failed or uncertain operations need a reviewed retry, never blind replay.
  failure: z.literal('stop').default('stop'),
})

export const workflowDefinitionSchema = z
  .strictObject({
    version: z.literal(1),
    name: z.string().trim().min(1).max(80),
    steps: z.array(workflowStepSchema).min(1).max(32),
  })
  .superRefine((definition, ctx) => {
    const ids = new Set<string>()
    for (const [index, step] of definition.steps.entries()) {
      if (ids.has(step.id))
        ctx.addIssue({
          code: 'custom',
          path: ['steps', index, 'id'],
          message: 'Step IDs must be unique.',
        })
      ids.add(step.id)
    }
    for (const [index, step] of definition.steps.entries()) {
      const dependencies = new Set(step.dependsOn)
      if (dependencies.size !== step.dependsOn.length)
        ctx.addIssue({
          code: 'custom',
          path: ['steps', index, 'dependsOn'],
          message: 'Include each dependency once.',
        })
      for (const dependency of dependencies)
        if (!ids.has(dependency) || dependency === step.id)
          ctx.addIssue({
            code: 'custom',
            path: ['steps', index, 'dependsOn'],
            message: 'Dependencies must name other steps in this workflow.',
          })
      const names = new Set<string>()
      for (const [inputIndex, input] of step.inputs.entries()) {
        if (names.has(input.name))
          ctx.addIssue({
            code: 'custom',
            path: ['steps', index, 'inputs', inputIndex, 'name'],
            message: 'Input names must be unique within a step.',
          })
        names.add(input.name)
        if (!dependencies.has(input.fromStep))
          ctx.addIssue({
            code: 'custom',
            path: ['steps', index, 'inputs', inputIndex, 'fromStep'],
            message: 'An input must come from an explicit dependency.',
          })
      }
    }
    const remaining = new Map(
      definition.steps.map((step) => [step.id, new Set(step.dependsOn)]),
    )
    while (remaining.size) {
      const ready = [...remaining]
        .filter(([, dependencies]) => dependencies.size === 0)
        .map(([id]) => id)
      if (!ready.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps'],
          message: 'Workflow dependencies must not contain a cycle.',
        })
        break
      }
      for (const id of ready) remaining.delete(id)
      for (const dependencies of remaining.values())
        for (const id of ready) dependencies.delete(id)
    }
  })

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>

const workflowCommandTarget = {
  id: z.uuid(),
  commandId: z.uuid(),
  expectedRevision: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER - 1),
}
export const workflowCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('save'),
    ...workflowCommandTarget,
    definition: workflowDefinitionSchema,
  }),
  z.strictObject({
    type: z.literal('archive'),
    ...workflowCommandTarget,
    expectedRevision: z
      .number()
      .int()
      .min(1)
      .max(Number.MAX_SAFE_INTEGER - 1),
  }),
])
