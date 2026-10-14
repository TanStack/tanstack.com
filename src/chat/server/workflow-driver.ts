import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers'
import { z } from 'zod'
import { conversationRunIdentitySchema } from '../core/conversation-runs'
import { workflowRunStatus, type WorkflowRun } from '../core/workflow-runs'

export const workflowDriverParamsSchema = z.strictObject({
  owner: conversationRunIdentitySchema,
  runId: z.uuid(),
})
export type WorkflowDriverParams = z.infer<typeof workflowDriverParamsSchema>

/** Only reconciliation receipts are persisted by the orchestrator. Conversation
 * owns execution, approvals, accounting, outputs and all current authorization. */
export interface WorkflowDriverEnvironment {
  CONVERSATIONS: {
    getByName(id: string): {
      advanceWorkflowRun(
        owner: WorkflowDriverParams['owner'],
        runId: string,
      ): Promise<WorkflowRun>
    }
  }
}
export class TanChatWorkflow extends WorkflowEntrypoint<
  WorkflowDriverEnvironment,
  WorkflowDriverParams
> {
  async run(event: WorkflowEvent<WorkflowDriverParams>, step: WorkflowStep) {
    const params = workflowDriverParamsSchema.parse(event.payload)
    const owner = this.env.CONVERSATIONS.getByName(params.owner.conversationId)
    for (let pass = 0; pass < 900; pass++) {
      const receipt = await step.do(
        `reconcile-${pass}`,
        {
          retries: { limit: 4, delay: '2 seconds', backoff: 'exponential' },
          timeout: '1 minute',
        },
        async () => {
          const run = await owner.advanceWorkflowRun(params.owner, params.runId)
          return {
            status: workflowRunStatus(run),
            deadline: run.request.deadline,
            checkedAt: Date.now(),
          }
        },
      )
      if (['completed', 'failed', 'cancelled'].includes(receipt.status))
        return { runId: params.runId, status: receipt.status }
      // Bound the number of durable steps even for a day-long run. Replayed
      // checkpoints use their recorded time, not a new non-deterministic clock.
      const delay = Math.max(
        2000,
        Math.ceil(
          (receipt.deadline - receipt.checkedAt) / Math.max(1, 880 - pass),
        ),
      )
      await step.sleep(`wait-${pass}`, delay)
    }
    // This is not a successful task result. An unresolved approved action can
    // outlive the deadline and must retain its outstanding journal receipt.
    return { runId: params.runId, status: 'needs_attention' }
  }
}
