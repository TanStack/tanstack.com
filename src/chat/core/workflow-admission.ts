import { z } from 'zod'
import { conversationRunIdentitySchema } from './conversation-runs'
import { runModelSchema } from './run-model'
import { delegationSourcesSchema } from './delegation-sources'
import { workflowStepIdSchema } from './workflows'

const time = z.number().int().nonnegative().safe()
/** Host-authored dispatch data, not a bearer grant or a client command. */
export const workflowStepAdmissionSchema = z
  .strictObject({
    id: z.uuid(),
    workflowRunId: z.uuid(),
    workflowId: z.uuid(),
    definitionRevision: z.number().int().positive().safe(),
    stepId: workflowStepIdSchema,
    owner: conversationRunIdentitySchema,
    childConversationId: z.uuid(),
    objective: z.string().trim().min(1).max(12000),
    model: runModelSchema,
    sources: delegationSourcesSchema,
    inputs: z
      .array(
        z.strictObject({
          name: workflowStepIdSchema,
          fromStep: workflowStepIdSchema,
          output: z.enum(['answer', 'files']),
          executionId: z.uuid(),
          resultId: z.string().min(1).max(200),
        }),
      )
      .max(32),
    createdAt: time,
    deadline: time,
  })
  .refine(
    (value) =>
      value.deadline > value.createdAt &&
      value.childConversationId === value.id &&
      value.childConversationId !== value.owner.conversationId &&
      new Set(value.inputs.map((input) => input.name)).size ===
        value.inputs.length,
    'Invalid workflow admission identity, inputs or deadline.',
  )
export type WorkflowStepAdmission = z.infer<typeof workflowStepAdmissionSchema>
