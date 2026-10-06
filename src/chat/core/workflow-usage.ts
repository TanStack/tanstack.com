import type { WorkflowRun } from './workflow-runs'
import type { TaskUsage } from './task-usage'
import { usageSummary } from './usage'

/** Recompute a step-only subtotal from exact child receipts, never accumulate polls. */
export function workflowUsage(
  run: WorkflowRun,
  reports: ReadonlyMap<string, TaskUsage | undefined>,
) {
  const totals = usageSummary([])
  let missingSteps = 0,
    runningSteps = 0
  for (const step of run.steps) {
    if (!step.admission) continue
    const usage = reports.get(step.admission.id)
    if (!usage || !usage.steps) missingSteps++
    if (!usage) continue
    runningSteps += usage.runningSteps
    totals.usd += usage.totals.usd
    totals.estimated ||= usage.totals.estimated
    totals.unavailable += usage.totals.unavailable
    totals.pricedRecords += usage.totals.pricedRecords
    totals.observedAttempts += usage.totals.observedAttempts
    totals.unobservedModelSteps += usage.totals.unobservedModelSteps
  }
  return {
    scope: 'workflow-steps' as const,
    totals,
    missingSteps,
    runningSteps,
  }
}
export type WorkflowUsage = ReturnType<typeof workflowUsage>
