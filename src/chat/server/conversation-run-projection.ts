import type { UIMessage } from '@tanstack/ai'
import type { AssistantTask } from '../core/assistant-task'
import type { Approval } from '../core/types'
import {
  initiatingRunMessageId,
  terminalRunStatuses,
  type ConversationRun,
  type ConversationRunOutcome,
} from '../core/conversation-runs'
import type { ConversationRuns } from './conversation-runs'

type RunState = {
  messages: UIMessage[]
  status: 'idle' | 'running' | 'error'
  activeRun: string | null
  currentRunId?: string
  runOutcome?: ConversationRunOutcome
  approvals: Approval[]
  assistantTask?: AssistantTask
  delegationWait?: string
  pendingTask?: unknown
  resumingTask?: unknown
  queue?: { items: Array<{ messageId: string }> }
  turnTimings?: Record<string, { startedAt: number; completedAt?: number }>
}

/** Called in the same SQLite transaction as conversation state. No model text
 * decides completion and imported transcript messages never create runs. */
export function projectConversationRuns(
  runs: ConversationRuns,
  state: RunState,
  now: number,
) {
  const current = state.messages
    .filter(
      (message) => message.role === 'user' && !message.metadata?.gumInherited,
    )
    .at(-1)
  const runId = state.currentRunId ?? current?.id
  const queued = new Set(state.queue?.items.map((item) => item.messageId))
  for (const record of runs.queued())
    if (!queued.has(record.id) && record.id !== runId)
      runs.update(record.id, {
        status: 'cancelled',
        completedAt: now,
        updatedAt: now,
      })
  const record = runId && runs.get(runId)
  if (!record) return // Older history has no authoritative admission receipt.
  const messageId = initiatingRunMessageId(record)
  const task =
    state.assistantTask?.messageId === messageId
      ? state.assistantTask
      : undefined
  const approvals = state.approvals.filter(
    (approval) =>
      approval.messageId === messageId ||
      (!!task && approval.assistantTaskId === task.id),
  )
  const running =
    state.status === 'running' || approvals.some((a) => a.status === 'running')
  // Queue errors and later transcript maintenance cannot rewrite a settled run.
  if (terminalRunStatuses.has(record.status) && !running) return
  const outcome =
    state.runOutcome?.runId === record.id ? state.runOutcome.status : undefined
  let status: ConversationRun['status']
  if (running) status = 'running'
  else if (approvals.some((a) => a.status === 'pending'))
    status = 'waiting_approval'
  else if (outcome === 'interrupted' || task?.status === 'interrupted')
    status = 'interrupted'
  else if (state.delegationWait) status = 'waiting_children'
  else if (state.pendingTask || state.resumingTask) status = 'waiting_user'
  else if (outcome) status = outcome
  else if (task?.status === 'incomplete') status = 'incomplete'
  else if (state.status === 'error') status = 'failed'
  else status = 'completed'
  const active = [
    'running',
    'waiting_approval',
    'waiting_user',
    'waiting_children',
  ].includes(status)
  const timing = state.turnTimings?.[messageId]
  const patch = {
    status,
    ...(record.startedAt === undefined && timing?.startedAt !== undefined
      ? { startedAt: timing.startedAt }
      : {}),
    ...(task ? { assistantTaskId: task.id } : {}),
    ...(state.activeRun ? { executionId: state.activeRun } : {}),
    completedAt: active
      ? null
      : (record.completedAt ?? timing?.completedAt ?? now),
  }
  if (
    Object.entries(patch).some(
      ([key, value]) =>
        (record[key as keyof ConversationRun] ?? null) !== value,
    )
  )
    runs.update(record.id, { ...patch, updatedAt: now })
}
