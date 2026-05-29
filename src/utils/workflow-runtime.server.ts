import { defineWorkflowRuntime } from '@tanstack/workflow-runtime'
import type {
  WorkflowExecutionStore,
  WorkflowRegistrationMap,
} from '@tanstack/workflow-runtime'
import { createDrizzlePostgresWorkflowStore } from '@tanstack/workflow-store-drizzle-postgres'
import { db } from '~/db/client'
import { createAppWorkflowRegistrations } from '~/utils/workflow-registrations.server'

export const WORKFLOW_RUNTIME_SWEEP_CRON = '*/5 * * * *'

export const workflowExecutionStore = createDrizzlePostgresWorkflowStore({ db })

export function createAppWorkflowRuntime(options?: {
  store?: WorkflowExecutionStore
  workflowRegistrations?: WorkflowRegistrationMap
}) {
  return defineWorkflowRuntime({
    store: options?.store ?? workflowExecutionStore,
    workflows:
      options?.workflowRegistrations ?? createAppWorkflowRegistrations(),
  })
}

export const workflowRuntime = createAppWorkflowRuntime()
