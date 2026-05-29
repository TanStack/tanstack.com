import type { Config } from '@netlify/functions'
import { createNetlifyWorkflowSweepHandler } from '@tanstack/workflow-netlify'
import { workflowRuntime } from '~/utils/workflow-runtime.server'

export default createNetlifyWorkflowSweepHandler({
  runtime: workflowRuntime,
  maxDurationMs: 25_000,
  maxScheduledRuns: 10,
  maxTimers: 10,
})

export const config: Config = {
  schedule: '*/5 * * * *',
}
