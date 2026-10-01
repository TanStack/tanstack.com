import { LoadingState } from './ui/LoadingState'
import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import type { ConversationDestination } from '../core/conversation-destination'
import type { ThreadListItem } from '../core/conversation-threads'
import {
  delegatedTaskLabel,
  type DelegatedTaskHistoryPage,
} from '../core/delegated-task-view'
import type { ThreadOpenIntent } from './ConversationThreads'
import { composerFocusHandoff } from './composer-focus'
import { IconButton } from './IconButton'
import { useWorkspaceApi } from './WorkspaceApi'
import { usageCostLabel } from './UsageDetails'
import { TaskUsageDetails } from './TaskUsageDetails'
import './delegated-tasks.css'

export function DelegatedTaskHistory({
  destination,
  threads,
  onOpen,
}: {
  destination: ConversationDestination
  threads: ThreadListItem[]
  onOpen: (thread: ThreadListItem, intent?: ThreadOpenIntent) => void
}) {
  const [open, setOpen] = useState(false)
  const { request } = useWorkspaceApi()
  const query = useInfiniteQuery({
    queryKey: [
      'delegated-task-history',
      destination.workspaceId,
      destination.userId,
      destination.conversationId,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      request<DelegatedTaskHistoryPage>(
        `${destination.apiPath}/delegations?view=history${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`,
        undefined,
        'GET',
        { signal },
      ),
    getNextPageParam: (page) => page.nextBeforeId,
    enabled: open,
    retry: false,
  })
  const items = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
    ).values(),
  ]
  return (
    <details
      className="delegated-task-history"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Task history</summary>
      {open && (
        <>
          <div className="delegated-history-heading">
            <small>Last recorded results</small>
            <IconButton
              label="Refresh task history"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCw size={14} aria-hidden />
            </IconButton>
          </div>
          {query.isError ? (
            <p role="alert" className="error">
              Task history could not be loaded.{' '}
              <button
                disabled={query.isFetching}
                onClick={() =>
                  void (query.isFetchNextPageError
                    ? query.fetchNextPage()
                    : query.refetch())
                }
              >
                Retry
              </button>
            </p>
          ) : (
            <>
              {query.isPending ? (
                <LoadingState>Loading tasks…</LoadingState>
              ) : items.length === 0 ? (
                <p>No delegated tasks yet.</p>
              ) : (
                <ul>
                  {items.map((task) => {
                    const thread = threads.find(
                      (item) => item.conversationId === task.conversationId,
                    )
                    return (
                      <li key={task.id}>
                        <details>
                          <summary>
                            <span>{task.objective}</span>
                            <small>{delegatedTaskLabel(task)}</small>
                          </summary>
                          <time
                            dateTime={new Date(task.createdAt).toISOString()}
                          >
                            {new Date(task.createdAt).toLocaleString()}
                          </time>
                          <p>
                            Recorded child usage:{' '}
                            {task.usage
                              ? usageCostLabel(task.usage.totals)
                              : 'Unavailable'}
                            {task.usage &&
                              ` · ${task.usage.totals.observedAttempts} model calls`}
                            {!!task.usage?.runningSteps &&
                              ' · unfinished snapshot'}
                          </p>
                          {task.answer ? (
                            <>
                              <p className="delegated-history-answer">
                                {task.answer.text}
                              </p>
                              {task.answer.truncated && (
                                <p>Saved result is truncated.</p>
                              )}
                            </>
                          ) : (
                            <p>No result was recorded.</p>
                          )}
                          {task.failure && (
                            <p className="error">{task.failure.message}</p>
                          )}
                          <HistoricalFamilyUsage
                            destination={destination}
                            taskId={task.parentTaskId}
                          />
                          {thread && (
                            <button
                              onClick={(event) =>
                                onOpen(thread, {
                                  source: event.currentTarget,
                                  messageId: task.answer?.messageId,
                                  handoff: composerFocusHandoff(
                                    event.currentTarget,
                                  ),
                                })
                              }
                            >
                              {task.answer
                                ? 'Open result'
                                : 'Open conversation'}
                            </button>
                          )}
                        </details>
                      </li>
                    )
                  })}
                </ul>
              )}
              {query.hasNextPage && (
                <button
                  disabled={query.isFetching}
                  onClick={() => void query.fetchNextPage()}
                >
                  Load older tasks
                </button>
              )}
            </>
          )}
        </>
      )}
    </details>
  )
}

function HistoricalFamilyUsage({
  destination,
  taskId,
}: {
  destination: ConversationDestination
  taskId: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Originating task usage</summary>
      {open && (
        <TaskUsageDetails
          destination={destination}
          taskId={taskId}
          active={false}
          visible
          historical
        />
      )}
    </details>
  )
}
