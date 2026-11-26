import { z } from 'zod'
import { usageSummary } from './usage'

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const taskUsageSchema = z.strictObject({
  taskId: z.string().min(1).max(128),
  steps: count,
  runningSteps: count,
  totals: z.strictObject({
    usd: z.number().nonnegative(),
    unavailable: count,
    estimated: z.boolean(),
    pricedRecords: count,
    observedAttempts: count,
    unobservedModelSteps: count,
  }),
})
export type TaskUsage = z.infer<typeof taskUsageSchema>
export interface ChildTaskUsage {
  id: string
  conversationId: string
  objective: string
  status: 'current' | 'stale' | 'unavailable' | 'not-started'
  usage?: TaskUsage
}
export interface TaskUsageSnapshot {
  /** Retained reports are not refreshed from child runtimes. */
  evidence?: 'retained'
  taskId: string
  observedAt: number
  active: boolean
  parent: TaskUsage
  children: ChildTaskUsage[]
  totals: TaskUsage['totals']
  missingTasks: number
}

/** Recompute from exact task receipts, never add snapshots to a running total. */
export function taskFamilyUsage(parent: TaskUsage, children: ChildTaskUsage[]) {
  const totals = usageSummary([])
  let missingTasks = 0
  const add = (usage?: TaskUsage) => {
    if (!usage?.steps) missingTasks++
    if (!usage) return
    totals.usd += usage.totals.usd
    totals.estimated ||= usage.totals.estimated
    totals.unavailable += usage.totals.unavailable
    totals.pricedRecords += usage.totals.pricedRecords
    totals.observedAttempts += usage.totals.observedAttempts
    totals.unobservedModelSteps += usage.totals.unobservedModelSteps
  }
  add(parent)
  for (const child of children) {
    if (child.status === 'not-started') continue
    const missing = missingTasks
    add(child.usage)
    if (child.status !== 'current' && missingTasks === missing) missingTasks++
  }
  return { totals, missingTasks }
}
