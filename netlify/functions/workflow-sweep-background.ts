import {
  createNetlifyWorkflowSweepConfig,
  createNetlifyWorkflowSweepHandler,
} from '@tanstack/workflow-netlify'
import {
  workflowRuntime,
  WORKFLOW_RUNTIME_SWEEP_CRON,
} from '~/utils/workflow-runtime.server'

export default createNetlifyWorkflowSweepHandler({
  runtime: workflowRuntime,
  maxDurationMs: 25_000,
  maxScheduledRuns: 10,
  maxTimers: 10,
})

export const config = createNetlifyWorkflowSweepConfig({
  schedule: WORKFLOW_RUNTIME_SWEEP_CRON,
})
