import { Button } from './ui/Button'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CornerDownRight, Square } from 'lucide-react'
import {
  delegatedTaskLabel,
  type DelegatedTasksSnapshot,
} from '../core/delegated-task-view'
import type { ConversationDestination } from '../core/conversation-destination'
import type { ThreadListItem } from '../core/conversation-threads'
import type { ThreadOpenIntent } from './ConversationThreads'
import { composerFocusHandoff } from './composer-focus'
import { useWorkspaceApi } from './WorkspaceApi'
import { IconButton } from './IconButton'
import './delegated-tasks.css'

export function useDelegatedTasks({
  destination,
  taskId,
  visible,
  active,
}: {
  destination: ConversationDestination
  taskId?: string
  visible: boolean
  active: boolean
}) {
  const { request } = useWorkspaceApi()
  const path = `${destination.apiPath}/delegations`
  const query = useQuery({
    queryKey: [
      'delegated-tasks',
      destination.workspaceId,
      destination.userId,
      destination.conversationId,
      taskId,
      active,
    ],
    queryFn: async ({ signal }) => {
      if (!taskId) throw new Error('No task is selected.')
      const snapshot = await request<DelegatedTasksSnapshot>(
        `${path}?task=${encodeURIComponent(taskId)}`,
        undefined,
        'GET',
        { signal },
      )
      if (snapshot.taskId !== taskId)
        throw new Error('The delegated tasks do not match this request.')
      return snapshot
    },
    enabled: visible && !!taskId,
    refetchInterval: (query) =>
      visible &&
      !!taskId &&
      (active ||
        query.state.data?.items.some(
          (item) => !['settled', 'cancelled'].includes(item.status),
        ))
        ? 2000
        : false,
    refetchIntervalInBackground: false,
    retry: false,
  })
  const [stopping, setStopping] = useState<string[]>([])
  const [error, setError] = useState<{ taskId: string; message: string }>()
  async function stop(id: string) {
    if (!taskId) return
    setStopping((ids) => [...ids, id])
    setError(undefined)
    try {
      await request(path, { type: 'stop', id, taskId })
      await query.refetch()
    } catch (error) {
      setError({
        taskId,
        message:
          error instanceof Error
            ? error.message
            : 'The task could not be stopped.',
      })
    } finally {
      setStopping((ids) => ids.filter((value) => value !== id))
    }
  }
  return {
    data: query.data,
    refreshError: query.error,
    error: error && error.taskId === taskId ? error.message : undefined,
    stopping,
    stop,
    refresh: () => query.refetch(),
  }
}

export function DelegatedTasks({
  state,
  readOnly,
  threads,
  onOpen,
}: {
  state: ReturnType<typeof useDelegatedTasks>
  readOnly: boolean
  threads: ThreadListItem[]
  onOpen: (thread: ThreadListItem, intent?: ThreadOpenIntent) => void
}) {
  const { data, refreshError, error, stopping, stop, refresh } = state
  // A failed refresh must not leave stale action controls enabled.
  if (refreshError)
    return (
      <p className="error" role="alert">
        Delegated tasks could not be refreshed.{' '}
        <Button
          type="button"
          variant="secondary"
          onClick={() => void refresh()}
        >
          Retry
        </Button>
      </p>
    )
  if (!data?.items.length) return null
  return (
    <section className="delegated-tasks" aria-label="Delegated tasks">
      <h3>{data.waiting ? 'Waiting for tasks' : 'Delegated tasks'}</h3>
      <ul>
        {data.items.map((task) => {
          const thread = threads.find(
            (item) => item.conversationId === task.conversationId,
          )
          const active = !['settled', 'cancelled', 'cancelling'].includes(
            task.status,
          )
          return (
            <li key={task.id}>
              {thread ? (
                <button
                  className="delegated-task-link"
                  onClick={(event) =>
                    onOpen(thread, {
                      source: event.currentTarget,
                      messageId: task.answer?.messageId,
                      handoff: composerFocusHandoff(event.currentTarget),
                    })
                  }
                >
                  <CornerDownRight size={14} aria-hidden />
                  <span title={task.objective}>{task.objective}</span>
                </button>
              ) : (
                <span className="delegated-task-title" title={task.objective}>
                  {task.objective}
                </span>
              )}
              <small>{delegatedTaskLabel(task)}</small>
              {task.failure && (
                <p className="delegated-task-failure">{task.failure.message}</p>
              )}
              {active && !readOnly && (
                <IconButton
                  className="delegated-task-stop"
                  label={`Stop task: ${task.objective}`}
                  disabled={stopping.includes(task.id)}
                  onClick={() => void stop(task.id)}
                >
                  <Square size={14} aria-hidden />
                </IconButton>
              )}
            </li>
          )
        })}
      </ul>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
