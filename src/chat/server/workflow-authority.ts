import { conversationRunIdentitySchema } from '../core/conversation-runs'
import { canonicalCopyJson } from '../core/conversation-copy'
import { workflowStepAdmissionSchema } from '../core/workflow-admission'
import {
  workflowOperationSchema,
  type WorkflowOperation,
} from '../core/workflow-operation'
import type { z } from 'zod'
import type { ModelEnvironment } from './run-models'
type ConversationIdentity = z.infer<typeof conversationRunIdentitySchema>
import { ConversationIdentityError } from '../conversation-identity.server'
import { resolveWorkflowContext } from './workflow-context'
import type { WorkflowRuns } from './workflow-runs'

/** Owner-local authority checks. The host binds its authenticated identity and
 * calls this before child dispatch/resume and every operation reservation.
 * Capability-specific approvals and payer/spend checks are still separate. */
export class WorkflowAuthority {
  private owner: ConversationIdentity
  constructor(
    private env: ModelEnvironment,
    private runs: WorkflowRuns,
    owner: ConversationIdentity,
    private now = () => Date.now(),
  ) {
    this.owner = conversationRunIdentitySchema.parse(owner)
  }
  async grant(rawChild: ConversationIdentity, rawAdmission: unknown) {
    const child = conversationRunIdentitySchema.parse(rawChild)
    const admission = workflowStepAdmissionSchema.parse(rawAdmission)
    if (
      canonicalCopyJson(admission.owner) !== canonicalCopyJson(this.owner) ||
      canonicalCopyJson(child) !==
        canonicalCopyJson({
          ...this.owner,
          conversationId: admission.childConversationId,
        })
    )
      throw new ConversationIdentityError()
    this.runs.activeAdmission(admission, this.now())
    await resolveWorkflowContext(
      this.env,
      this.owner,
      admission.model,
      child.conversationId,
    )
    // Async database/configuration work can race cancellation or expiry. Only
    // the current owner journal can confirm this exact dispatch is still live.
    return this.runs.activeAdmission(admission, this.now())
  }
  async reserve(
    child: ConversationIdentity,
    rawAdmission: unknown,
    rawOperation: WorkflowOperation,
  ) {
    const operation = workflowOperationSchema.parse(rawOperation)
    const admission = await this.grant(child, rawAdmission)
    return this.runs.reserve(admission, operation, this.now())
  }
}
