import type { WorkflowRegistrationMap } from '@tanstack/workflow-runtime'
import { createIntentWorkflowRegistrations } from '~/utils/intent-workflows.server'

export function createAppWorkflowRegistrations(): WorkflowRegistrationMap {
  return {
    ...createIntentWorkflowRegistrations(),
  }
}
