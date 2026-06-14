import { defineWorkflowRuntime } from '@tanstack/workflow-runtime'
import { createDrizzlePostgresWorkflowStore } from '@tanstack/workflow-store-drizzle-postgres'
import { db } from '~/db/client'
import { intentWorkflowRegistrations } from '~/utils/intent-workflows.server'

export const workflowExecutionStore = createDrizzlePostgresWorkflowStore({ db })

export const workflowRuntime = defineWorkflowRuntime({
  store: workflowExecutionStore,
  workflows: intentWorkflowRegistrations,
})
