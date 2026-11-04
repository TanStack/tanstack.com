import type { ConversationRun } from './conversation-runs'
import type { DelegationRecord } from './delegation'
import type { DelegationReport } from './delegation-report'

/** Public task evidence, without the captured source, context or access identity. */
export interface DelegatedTaskView {
  id: string
  conversationId: string
  objective: string
  status: DelegationRecord['status']
  observedAt: number
  runStatus?: ConversationRun['status']
  answer?: DelegationReport['answer']
  failure?: DelegationReport['failure']
}
export interface DelegatedTasksSnapshot {
  taskId: string
  waiting: boolean
  items: DelegatedTaskView[]
}
export interface DelegatedTaskHistoryPage {
  /** Reports retained by the parent, not a fresh read of each child runtime. */
  evidence: 'retained'
  items: Array<
    DelegatedTaskView & {
      parentTaskId: string
      parentRunId: string
      sourceMessageId: string
      createdAt: number
      /** Last retained child report, not a refreshed or whole-family total. */
      usage?: DelegationReport['usage']
    }
  >
  nextBeforeId?: string
}
export function presentDelegatedTask(
  record: DelegationRecord,
  report?: DelegationReport,
): DelegatedTaskView {
  return {
    id: record.id,
    conversationId: record.childConversationId,
    objective: record.objective,
    status: record.status,
    observedAt: Math.max(record.updatedAt, report?.run.updatedAt ?? 0),
    ...(report
      ? {
          runStatus: report.run.status,
          answer: report.answer,
          failure: report.failure,
        }
      : {}),
  }
}
export function delegatedTaskLabel(task: DelegatedTaskView) {
  if (task.status === 'cancelling') return 'Stopping'
  if (task.status === 'cancelled') return 'Stopped'
  if (task.runStatus)
    return {
      queued: 'Queued',
      running: 'Working',
      waiting_approval: 'Needs approval',
      waiting_user: 'Needs attention',
      waiting_children: 'Waiting',
      completed: 'Finished',
      failed: 'Failed',
      interrupted: 'Interrupted',
      cancelled: 'Stopped',
      incomplete: 'Incomplete',
    }[task.runStatus]
  return task.status === 'pending' ? 'Queued' : 'Starting'
}
