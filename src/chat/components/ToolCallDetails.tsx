import { CodeBlock } from './MessageMarkdown'
import type { ToolCallPart, ToolResultPart } from '@tanstack/ai'
import { ChevronRight, Link2 } from 'lucide-react'
import type { Approval } from '../core/types'
import type { ToolReceipt } from '../core/conversation-copy'
import { historicalReceiptStatus } from './HistoricalReceipts'
import { KodyRunDetails } from './KodyRunDetails'

export function formatToolValue(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  return JSON.stringify(value, null, 2) ?? ''
}

export function ToolCallDetails({
  call,
  result,
  running,
  open,
  onOpenChange,
  approvals,
  historical = false,
  receipts,
}: {
  call: ToolCallPart
  result?: ToolResultPart
  running: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  approvals?: Approval[]
  historical?: boolean
  receipts?: ToolReceipt[]
}) {
  const output = result ? result.content : call.output
  const failed = call.state === 'error' || result?.state === 'error'
  const pendingApproval = call.state === 'approval-requested'
  const complete = result?.state === 'complete' || call.state === 'complete'
  let prepared = false
  let approval: Approval | undefined
  try {
    const value = typeof output === 'string' ? JSON.parse(output) : output
    prepared = value?.status === 'awaiting_user_approval'
    if (value?.approvalId)
      approval = (historical ? receipts : approvals)?.find(
        (a) => a.id === value.approvalId,
      )
  } catch {}
  const historicalState =
    call.metadata &&
    typeof call.metadata === 'object' &&
    'gumHistoricalState' in call.metadata
      ? call.metadata.gumHistoricalState
      : undefined
  const status = historical
    ? approval
      ? historicalReceiptStatus(approval)
      : prepared || historicalState === 'approval-requested'
        ? 'Historical, not executed'
        : complete
          ? 'Historical, complete'
          : historicalState === 'error' || result?.error
            ? 'Historical, failed'
            : 'Historical, incomplete'
    : approval
      ? approval.executionOutcome === 'unknown'
        ? 'Outcome unknown'
        : (
            {
              pending: 'Needs approval',
              running: 'Running',
              done: 'Executed',
              rejected: 'Declined',
              error: 'Failed',
            } as const
          )[approval.status]
      : failed
        ? 'Failed'
        : pendingApproval
          ? 'Needs approval'
          : prepared
            ? 'Prepared'
            : complete
              ? 'Complete'
              : running
                ? 'Working'
                : 'Interrupted'
  const toolLabels: Record<string, string> = {
    delegate_task: 'Delegate task',
    inspect_task: 'Check delegated task',
    wait_for_tasks: 'Wait for tasks',
    stop_task: 'Stop delegated task',
    save_file: 'Save file',
    copy_file: 'Copy file',
    read_file: 'Read file',
    workspace_read_file: 'Read workspace file',
    workspace_write_file: 'Write workspace file',
    workspace_run: 'Run workspace command',
    list_files: 'Find saved files',
    list_workspace_conversations: 'Find conversations',
    inspect_conversation_settings: 'Inspect conversation settings',
    rename_conversation: 'Rename conversation',
    set_conversation_pinned: 'Set conversation pin',
    list_conversation_sections: 'Find sections',
    rename_conversation_section: 'Rename section',
    set_conversation_section: 'Move conversation to section',
    read_conversation: 'Read selected conversation',
    continue_conversation: 'Read more conversation history',
    list_schedules: 'Find schedules',
    manage_schedule: 'Manage schedule',
    resolve_schedule_time: 'Resolve schedule time',
    save_memory: 'Save memory',
    edit_memory: 'Edit memory',
    forget_memory: 'Forget memory',
    search_memory: 'Search memory',
    read_memory: 'Read memory',
    list_available_tools: 'Find tools',
    list_connected_devices: 'Find connected devices',
    read_device_folder: 'Read device folder',
    load_tools: 'Load tools',
    list_skills: 'Find skills',
    read_skill: 'Read skill',
    list_plugins: 'Find plugins',
    inspect_plugin: 'Inspect plugin',
    read_plugin_file: 'Read plugin file',
    list_connected_tools: 'Find connected tools',
    inspect_connected_tool: 'Inspect connected tool',
    call_connected_tool: 'Prepare connected action',

    present_file: 'Show file',
    wikipedia_search: 'Search Wikipedia',
    wikipedia_read: 'Read Wikipedia',
    jev_decision: 'Jev decision',
    jev_verification: 'Check answer evidence',
    research_usage: 'Research usage',
    kody_inspect: 'Inspect Kody',
    tool_discovery: 'Discover tools',
    mcp_inventory: 'Capability inventory',
    mcp_catalog: 'MCP catalog',
    jev_discovery: 'Choose discovery paths',
    discovery_interpretation: 'Interpret discovery',
    mcp_discovery_read: 'Read discovery metadata',
    discovery_integration_gap: 'Discovery format needs support',
    discovery_summary: 'Discovery results',
    jev_tool_selection: 'Jev tool selection',
    jev_tool_ranking: 'Rank available tools',
    inspect_proposed_tool: 'Inspect proposed tool',
    capability_contract: 'Capability contract',
    kody_propose_call: 'Prepare Kody call',
    run_code: 'Prepare code run',
  }
  const label =
    toolLabels[call.name] ??
    (call.name === 'kody_answer_question'
      ? 'Ask Kody'
      : call.name === 'kody_search'
        ? 'Search Kody'
        : call.name === 'kody_propose_execution'
          ? 'Prepare Kody action'
          : call.name || 'Tool call')

  const formattedInput = formatToolValue(call.input ?? call.arguments)
  return (
    <details
      className="tool-call"
      open={open}
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}
    >
      <summary>
        <ChevronRight size={14} className="tool-chevron" aria-hidden="true" />
        <Link2 size={13} aria-hidden="true" />
        <span className="tool-label">{approval?.title ?? label}</span>
        <span
          className={`tool-status${(historical ? historicalState === 'error' || !!result?.error : failed) || approval?.status === 'error' ? ' failed' : ''}`}
        >
          {status}
        </span>
      </summary>
      <div className="tool-details">
        {label !== call.name && <code className="tool-name">{call.name}</code>}
        {formattedInput !== '{}' && (
          <>
            <div className="tool-detail-label">Input</div>
            <CodeBlock code={formattedInput || 'No input yet.'} lang="json" />
          </>
        )}
        {output !== undefined && !approval && (
          <>
            <div className="tool-detail-label">Result</div>
            <CodeBlock
              code={formatToolValue(output) || 'Empty result.'}
              lang="json"
            />
          </>
        )}
        {result?.error && (
          <>
            <div className="tool-detail-label">Error</div>
            <pre>{result.error}</pre>
          </>
        )}
        {approval?.result && (
          <>
            <div className="tool-detail-label">Execution result</div>
            <CodeBlock code={formatToolValue(approval.result)} lang="json" />
          </>
        )}
        {approval?.kodyRunId && <KodyRunDetails runId={approval.kodyRunId} />}
        {output === undefined && !result?.error && (
          <p>
            {historical
              ? 'No result was recorded.'
              : failed
                ? 'No error details were returned.'
                : complete
                  ? 'No result was returned.'
                  : 'No result yet.'}
          </p>
        )}
      </div>
    </details>
  )
}
