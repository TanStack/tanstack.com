import { useDebugDetails } from './useDebugDetails'
import type { UIMessage } from '@tanstack/ai'
import type { ReactNode } from 'react'
import {
  Building2,
  Monitor,
  Cloud,
  Cpu,
  History,
  CircleDot,
  MessageSquare,
  ChevronRight,
  Clock3,
  ShieldCheck,
  Link2,
  ListOrdered,
  type LucideIcon,
} from 'lucide-react'
import type { Approval, Trace } from '../core/types'
import type { PendingTask } from '../core/tasks'
import type { QueueSnapshot } from '../core/conversation-queue'
import {
  readScheduledRunOrigin,
  readDelegatedRunOrigin,
  type ConversationRun,
  type ConversationRunStatus,
} from '../core/conversation-runs'
import type { UsageStep } from '../core/usage'
import { messageText } from '../core/message-navigation'
import { UsageDetails } from './UsageDetails'
import type { AssistantTask } from '../core/assistant-task'
import { taskContext } from '../core/task-context'
import { TaskSources } from './TaskSources'
import { RequestContextDetails } from './ContextIndicator'
import { contextSummary } from './context-summary'
import './conversation-details.css'

export interface ConversationDetailsHistory {
  transcriptEpoch?: string
  messages: UIMessage[]
  status: string
  activeRun: string | null
  approvals: Approval[]
  delegationWait?: string
  pendingTask?: PendingTask
  usageSteps?: UsageStep[]
  traces: Trace[]
  queue?: QueueSnapshot
  archivedTurns?: number
  toolStates?: Record<string, string>
  runs?: ConversationRun[]
  assistantTask?: AssistantTask
}
const runStatuses: Record<ConversationRunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  waiting_approval: 'Waiting for approval',
  waiting_user: 'Waiting for you',
  waiting_children: 'Waiting for delegated work',
  completed: 'Finished',
  incomplete: 'Incomplete',
  interrupted: 'Interrupted',
  cancelled: 'Cancelled',
  failed: 'Failed',
}
const runModes: Record<ConversationRun['mode'], string> = {
  assistant: 'Assistant',
  'system-one': 'System One',
  tools: 'Tool suggestions',
}
function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="details-summary-row">
      <dt>
        <Icon size={17} aria-hidden />
        <span>{label}</span>
      </dt>
      <dd title={value}>{value}</dd>
    </div>
  )
}
export function ConversationDetails({
  tab,
  history,
  environment,
  execution,
  taskUsage,
  delegatedTasks,
  workflows,
  onSelectMessage,
}: {
  tab: 'summary' | 'usage' | 'activity'
  history: ConversationDetailsHistory
  environment: {
    fixture: boolean
    workspaceName: string
    provider: string
    model: string
    connections: Array<{ label: string; enabled: boolean }>
  }
  developer: boolean
  execution?: ReactNode
  taskUsage?: ReactNode
  delegatedTasks?: ReactNode
  workflows?: ReactNode
  onSelectMessage: (id: string) => void
}) {
  const [debugDetails] = useDebugDetails()
  const steps = history.usageSteps ?? []
  const modelContext = contextSummary({
    steps,
    taskId: history.assistantTask?.id,
    transcriptEpoch: history.transcriptEpoch,
  })
  const context = taskContext(history.messages, history.assistantTask)
  const latest = context.message
  const requestId = history.assistantTask?.messageId ?? latest?.id
  const requestText = latest
    ? messageText(latest)
    : history.assistantTask?.objective
  const pending = history.approvals.filter((a) => a.status === 'pending')
  const running = history.approvals.filter((a) => a.status === 'running')
  const taskOutcome =
    history.assistantTask?.status === 'answered'
      ? 'Answered'
      : history.assistantTask?.status === 'incomplete'
        ? 'Incomplete'
        : history.assistantTask?.status === 'interrupted'
          ? 'Interrupted'
          : undefined
  const model = [...steps]
    .filter((step) => step.kind === 'model')
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  const status = running.length
    ? 'Running action'
    : history.status === 'running'
      ? 'Working'
      : history.delegationWait
        ? 'Waiting for delegated work'
        : pending.length
          ? 'Waiting for approval'
          : history.pendingTask
            ? 'Waiting for you'
            : history.status === 'error'
              ? 'Could not finish'
              : 'Idle'
  const calls = history.messages.flatMap((message) =>
    message.parts.flatMap((part) =>
      part.type === 'tool-call' ? [{ messageId: message.id, part }] : [],
    ),
  )
  const thinking = history.messages.flatMap((message) =>
    message.parts.flatMap((part, index) =>
      part.type === 'thinking' && part.content.trim()
        ? [{ id: `${message.id}:${index}`, content: part.content }]
        : [],
    ),
  )
  const runs = [...(history.runs ?? [])]
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
    .slice(0, 20)
  return (
    <div
      className={`conversation-details${tab === 'summary' ? ' details-summary' : ''}`}
    >
      {tab === 'summary' && (
        <>
          {debugDetails && (
            <section>
              <h3>Environment</h3>
              <dl>
                <SummaryRow
                  icon={Building2}
                  label="Workspace"
                  value={environment.workspaceName}
                />
                <SummaryRow icon={Monitor} label="Interface" value="Browser" />
                <SummaryRow
                  icon={Cloud}
                  label="Runtime"
                  value={
                    environment.fixture ? 'Local preview' : 'Cloudflare Workers'
                  }
                />
                <SummaryRow
                  icon={Cpu}
                  label="Request model"
                  value={`${environment.provider || 'Not recorded'}${environment.model.trim() ? ` / ${environment.model}` : ''}`}
                />
                {model && (
                  <SummaryRow
                    icon={History}
                    label="Last recorded model"
                    value={`${model.provider} / ${model.model ?? 'Not recorded'}`}
                  />
                )}
              </dl>
            </section>
          )}
          <section>
            <h3>Conversation</h3>
            <dl>
              <SummaryRow icon={CircleDot} label="Status" value={status} />
              {taskOutcome && (
                <SummaryRow
                  icon={MessageSquare}
                  label="Task outcome"
                  value={taskOutcome}
                />
              )}
              {!!history.queue?.items.length && (
                <SummaryRow
                  icon={ListOrdered}
                  label="Queue"
                  value={`${history.queue.items.length} queued${history.queue.paused ? ' · Paused' : ''}`}
                />
              )}
            </dl>
            {taskOutcome &&
              history.assistantTask?.status !== 'answered' &&
              history.assistantTask?.reason && (
                <p className="details-note">{history.assistantTask.reason}</p>
              )}
            {requestId && requestText && (
              <button
                className="details-summary-link"
                aria-label={`${latest && readScheduledRunOrigin(latest) ? 'Latest scheduled request' : latest && readDelegatedRunOrigin(latest) ? 'Latest delegated task' : history.assistantTask ? 'Task request' : 'Latest request'}: ${requestText}`}
                title={requestText}
                onClick={() => onSelectMessage(requestId)}
              >
                <MessageSquare size={17} aria-hidden />
                <span>{requestText}</span>
                <ChevronRight size={15} aria-hidden />
              </button>
            )}
          </section>
          {[
            { title: 'Approval needed', items: pending, icon: ShieldCheck },
            { title: 'Running actions', items: running, icon: Clock3 },
          ]
            .filter((group) => group.items.length)
            .map((group) => (
              <section key={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((action) => (
                    <li className="details-summary-item" key={action.id}>
                      <group.icon size={17} aria-hidden />
                      <span title={action.title}>{action.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          {history.pendingTask && (
            <section>
              <h3>{history.pendingTask.title}</h3>
              <p>{history.pendingTask.instructions}</p>
            </section>
          )}
          <TaskSources sources={context.sources} />
          {modelContext && (
            <section>
              <h3>Request context</h3>
              <RequestContextDetails summary={modelContext} />
            </section>
          )}
          {delegatedTasks}
          {execution}
          {!!environment.connections.length && (
            <section>
              <h3>Configured connections</h3>
              <ul>
                {environment.connections.map((connection, index) => (
                  <li className="details-summary-item" key={index}>
                    <Link2 size={17} aria-hidden />
                    <span title={connection.label}>{connection.label}</span>
                    {!connection.enabled && <small>Disabled</small>}
                  </li>
                ))}
              </ul>
              <p className="details-note">
                Configuration does not confirm working access.
              </p>
            </section>
          )}
        </>
      )}
      {tab === 'usage' && (
        <>
          {taskUsage}
          {steps.length ? (
            <>
              <UsageDetails steps={steps} />
              <p className="details-note">
                Recent records only, not lifetime usage or current context size.
              </p>
            </>
          ) : (
            <p>No usage recorded yet.</p>
          )}
        </>
      )}
      {tab === 'activity' && (
        <>
          {workflows}
          <section>
            <h3>Recent runs</h3>
            {runs.length ? (
              <ol className="details-runs">
                {runs.map((run) => (
                  <li key={run.id}>
                    <div>
                      <strong>{runStatuses[run.status]}</strong>
                      <time dateTime={new Date(run.createdAt).toISOString()}>
                        {new Date(run.createdAt).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <span>
                      {run.origin.kind === 'schedule'
                        ? 'Scheduled'
                        : run.origin.kind === 'delegation'
                          ? 'Delegated'
                          : run.origin.kind === 'workflow'
                            ? 'Workflow'
                            : 'User initiated'}
                      {' · '}
                      {runModes[run.mode]}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No runs recorded yet.</p>
            )}
          </section>
          <section>
            <h3>Tool calls</h3>
            {calls.length ? (
              <ol className="details-calls">
                {calls.map(({ messageId, part }) => (
                  <li key={`${messageId}:${part.id}`}>
                    <button onClick={() => onSelectMessage(messageId)}>
                      <strong>{part.name}</strong>
                      <span>{history.toolStates?.[part.id] ?? part.state}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No tool calls in the loaded messages.</p>
            )}
            {!!history.archivedTurns && (
              <p className="details-note">
                Earlier archived activity is available in the conversation.
              </p>
            )}
          </section>
          {debugDetails && !!thinking.length && (
            <details>
              <summary>Model thinking</summary>
              {thinking.map((part) => (
                <pre key={part.id}>{part.content}</pre>
              ))}
            </details>
          )}
          {debugDetails && !!history.traces.length && (
            <details>
              <summary>Recorded diagnostics</summary>
              {history.traces.map((trace) => (
                <div className="details-trace" key={trace.id}>
                  <small>
                    {new Date(trace.time).toLocaleTimeString()} · {trace.kind}
                  </small>
                  <strong>{trace.label}</strong>
                  {trace.detail && <pre>{trace.detail}</pre>}
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  )
}
