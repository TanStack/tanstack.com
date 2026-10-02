import { LoadingState } from './ui/LoadingState'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import type { ConversationDestination } from '../core/conversation-destination'
import type { TaskUsage, TaskUsageSnapshot } from '../core/task-usage'
import { useWorkspaceApi } from './WorkspaceApi'
import { usageCostLabel } from './UsageDetails'
import { IconButton } from './IconButton'
import './task-usage.css'

export function TaskUsageDetails({
  destination,
  taskId,
  active,
  visible,
  historical = false,
}: {
  destination: ConversationDestination
  taskId: string
  active: boolean
  visible: boolean
  historical?: boolean
}) {
  const { request } = useWorkspaceApi()
  const query = useQuery({
    queryKey: [
      'task-usage',
      destination.workspaceId,
      destination.userId,
      destination.conversationId,
      taskId,
      active,
      historical,
    ],
    queryFn: () =>
      request<TaskUsageSnapshot>(
        `${destination.apiPath}/task-usage?task=${encodeURIComponent(taskId)}${historical ? '&view=history' : ''}`,
      ),
    enabled: visible,
    refetchInterval: (query) =>
      !historical && visible && (active || query.state.data?.active)
        ? 2000
        : false,
    refetchIntervalInBackground: false,
    retry: false,
  })
  return (
    <section className="task-usage" aria-label="Task usage">
      <div className="task-usage-heading">
        <h3>
          {historical
            ? 'Recorded task cost'
            : active || query.data?.active
              ? 'Task cost so far'
              : 'Task cost'}
        </h3>
        <IconButton
          label="Refresh task usage"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={14} aria-hidden />
        </IconButton>
      </div>
      {query.error ? (
        <p role="alert">Task usage could not be refreshed.</p>
      ) : query.data ? (
        <TaskUsageBreakdown snapshot={query.data} />
      ) : (
        <LoadingState>Loading task usage…</LoadingState>
      )}
    </section>
  )
}

const taskCost = (usage?: TaskUsage) =>
  usage?.steps ? usageCostLabel(usage.totals) : 'No usage recorded'

export function TaskUsageBreakdown({
  snapshot,
}: {
  snapshot: TaskUsageSnapshot
}) {
  const totals = {
    ...snapshot.totals,
    unavailable: snapshot.totals.unavailable + snapshot.missingTasks,
  }
  return (
    <>
      {snapshot.evidence === 'retained' && (
        <p className="details-note">
          Parent receipts and last recorded child usage. Child runtimes were not
          refreshed.
        </p>
      )}
      <p className="task-usage-total">{usageCostLabel(totals)}</p>
      <details>
        <summary>
          {snapshot.children.length
            ? `This task + ${snapshot.children.length} delegated ${snapshot.children.length === 1 ? 'task' : 'tasks'}`
            : 'This task'}
        </summary>
        <dl>
          <div>
            <dt>This conversation</dt>
            <dd>{taskCost(snapshot.parent)}</dd>
          </div>
          {snapshot.children.map((child) => (
            <div key={child.id}>
              <dt>{child.objective}</dt>
              <dd>
                {child.status === 'not-started'
                  ? 'Not started'
                  : child.status === 'unavailable'
                    ? 'Usage unavailable'
                    : `${taskCost(child.usage)}${child.status === 'stale' ? ' · Last recorded' : ''}`}
              </dd>
            </div>
          ))}
        </dl>
        <p className="details-note">
          {snapshot.totals.observedAttempts} recorded provider{' '}
          {snapshot.totals.observedAttempts === 1 ? 'attempt' : 'attempts'},
          including retries. Excludes hosting and unreported charges.
        </p>
        <p className="details-note">
          Checked{' '}
          <time dateTime={new Date(snapshot.observedAt).toISOString()}>
            {new Date(snapshot.observedAt).toLocaleTimeString()}
          </time>
        </p>
      </details>
      {(totals.unavailable > 0 || totals.unobservedModelSteps > 0) && (
        <p className="details-note">
          Some usage is missing, incomplete or could not be refreshed.
        </p>
      )}
    </>
  )
}
