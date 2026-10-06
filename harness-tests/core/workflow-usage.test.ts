import { expect, it } from 'vitest'
import { workflowUsage } from '../../src/chat/core/workflow-usage'
import type { WorkflowRun } from '../../src/chat/core/workflow-runs'
import type { TaskUsage } from '../../src/chat/core/task-usage'
const report: TaskUsage = {
  taskId: 'task',
  steps: 1,
  runningSteps: 0,
  totals: {
    usd: 0.01,
    unavailable: 0,
    estimated: true,
    pricedRecords: 2,
    observedAttempts: 2,
    unobservedModelSteps: 0,
  },
}
it('recomputes exact admitted-step costs without treating unread children as free', () => {
  const run = {
    steps: [
      { admission: { id: 'one' } },
      { admission: { id: 'two' } },
      { status: 'pending' },
    ],
  } as WorkflowRun
  const reports = new Map([['one', report]])
  expect(workflowUsage(run, reports)).toMatchObject({
    scope: 'workflow-steps',
    missingSteps: 1,
    totals: { usd: 0.01, observedAttempts: 2 },
  })
  reports.set('two', {
    ...report,
    runningSteps: 1,
    totals: { ...report.totals, unavailable: 1 },
  })
  const expected = {
    missingSteps: 0,
    runningSteps: 1,
    totals: { usd: 0.02, unavailable: 1, pricedRecords: 4 },
  }
  expect(workflowUsage(run, reports)).toMatchObject(expected)
  expect(workflowUsage(run, reports)).toMatchObject(expected)
  expect(report.totals.usd).toBe(0.01)
})
