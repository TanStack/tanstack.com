import type { AssistantProgress } from './assistant-progress'
import type { MessageReference, ReferenceInput } from './message-references'
import type { RunModelSelection } from './run-model'
import type { ResponsePreferencesSnapshot } from './account-preferences'
import type { DelegationSource } from './delegation-sources'
import type { ToolEvidence } from './tool-evidence'
/** Task state survives model passes, approvals, reconnects, and client navigation. */
export interface AssistantTask {
  /** Missing on older tasks, whose earlier tool calls were not recorded. */
  toolEvidence?: ToolEvidence
  /** Discovery identities only, resolved against current MCP contracts on resume. */
  discoveredMcpEntries?: Array<{ id: string; serverId: string }>
  /** Frozen server-side at user admission; absent legacy values mean disabled. */
  memoryRecall?: boolean
  /** Undefined is a legacy task; null waits for an authenticated server snapshot. */
  responsePreferences?: ResponsePreferencesSnapshot | null
  progress?: AssistantProgress
  /** Older accepted tasks retain their original deterministic file IDs on retry. */
  fileIdentityVersion?: 2
  references?: ReferenceInput[]
  /** Selection-time display metadata only, never execution or delegation authority. */
  selectedReferences?: MessageReference[]
  /** Frozen selectors for explicitly selected files/conversations, not permissions. */
  delegationSources?: DelegationSource[]
  /** Skills read during this task, kept separate from explicit composer selections. */
  loadedSkills?: Array<{ skillId: string; version: number }>
  /** Discovery state only. Resolve against the current authorized inventory each pass. */
  loadedTools?: string[]
  /** Immutable installed package versions used by this task. */
  loadedPlugins?: Array<{ installationId: string; version: number }>
  runModel?: RunModelSelection
  id: string
  messageId: string
  objective: string
  status: 'running' | 'waiting' | 'answered' | 'incomplete' | 'interrupted'
  reason?: string
  modelPasses: number
  toolCalls: number
  repairs: number
  executionRevision: number
  setupLinks?: Array<{ ref: string; urls: string[] }>
  /** Legacy tasks may contain raw call history. Cleared on the next call. */
  recentCalls?: Array<{ key: string; revision: number }>
  observations: Array<{
    approvalId: string
    title: string
    outcome: 'succeeded' | 'failed' | 'unknown' | 'rejected'
    result: unknown
    kodyEntity?: string
    /** Exact named prerequisite from a failed Kody integration lookup. */
    missingKodyIntegration?: string
    /** Read-only package documentation recovered from a failed Kody action. */
    packageDocumentation?: {
      entity: string
      content: string
      excerpted: boolean
    }
  }>
}

export const assistantLimits = { modelPasses: 24, toolCalls: 48, repairs: 8 }
export function newAssistantTask(
  objective: string,
  messageId: string,
): AssistantTask {
  return {
    toolEvidence: { observedCalls: 0, reportedErrors: 0, calls: [] },
    responsePreferences: null,
    fileIdentityVersion: 2,
    id: crypto.randomUUID(),
    messageId,
    objective,
    status: 'running',
    modelPasses: 0,
    toolCalls: 0,
    repairs: 0,
    executionRevision: 0,
    observations: [],
  }
}

/** Stable object ordering prevents superficial key reordering from evading loop detection. */
export function callKey(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(callKey).join(',') + ']'
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + callKey(v))
        .join(',') +
      '}'
    )
  return JSON.stringify(value) ?? 'null'
}

export function assistantCallLimitReason(task: AssistantTask) {
  if (task.toolCalls >= assistantLimits.toolCalls)
    return 'The task reached its tool limit.'
  if (task.repairs >= assistantLimits.repairs)
    return 'The task could not recover after several tool errors.'
}

export function checkAssistantCall(
  task: AssistantTask,
  name: string,
  args: unknown,
) {
  const reason = assistantCallLimitReason(task)
  if (reason) return reason
  delete task.recentCalls
  task.toolCalls++
}
