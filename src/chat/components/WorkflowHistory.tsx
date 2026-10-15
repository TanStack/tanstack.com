import { LoadingState } from './ui/LoadingState'
import { useRef, useState } from 'react'
import { WorkflowStart } from './WorkflowStart'
import type { RunModelSelection } from '../core/run-model'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { RefreshCw, Square } from 'lucide-react'
import type {
  WorkflowRunInspection,
  WorkflowRunSummary,
} from '../core/workflow-inspection'
import { useWorkspaceApi } from './WorkspaceApi'
import { IconButton } from './IconButton'
import { MessageMarkdown } from './MessageMarkdown'
import { SavedFileDeliveries } from './SavedFileDeliveries'
import type { FileDelivery } from '../core/file-deliveries'
import './workflow-history.css'

const labels: Record<string, string> = {
  running: 'In progress',
  completed: 'Finished',
  failed: 'Failed',
  cancelled: 'Cancelled',
  cancelling: 'Stopping',
  stopping: 'Stopping',
  pending: 'Waiting',
  dispatched: 'In progress',
}
function WorkflowFiles({
  run,
  stepId,
}: {
  run: WorkflowRunInspection['run']
  stepId: string
}) {
  const api = useWorkspaceApi()
  const [open, setOpen] = useState(false)
  const files = useInfiniteQuery({
    queryKey: [
      'workflow-files',
      api.workspaceId,
      run.request.scope.userId,
      run.request.scope.conversationId,
      run.request.id,
      stepId,
    ],
    enabled: open,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.request<{ items: FileDelivery[]; nextOffset: number | null }>(
        `conversations/${encodeURIComponent(run.request.scope.conversationId)}/workflow-runs/files`,
        { runId: run.request.id, stepId, offset: pageParam },
        'POST',
        { signal },
      ),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  })
  const items = files.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Files</summary>
      {files.error ? (
        <p role="alert">
          Could not read these files.{' '}
          <button type="button" onClick={() => void files.refetch()}>
            Retry
          </button>
        </p>
      ) : files.data ? (
        items.length ? (
          <SavedFileDeliveries deliveries={items} />
        ) : (
          <p>No files were delivered.</p>
        )
      ) : open ? (
        <LoadingState>Loading files…</LoadingState>
      ) : null}
      {files.hasNextPage && (
        <button
          type="button"
          disabled={files.isFetchingNextPage}
          onClick={() => void files.fetchNextPage()}
        >
          More files
        </button>
      )}
    </details>
  )
}
function WorkflowAnswer({
  run,
  stepId,
}: {
  run: WorkflowRunInspection['run']
  stepId: string
}) {
  const api = useWorkspaceApi()
  const [open, setOpen] = useState(false)
  const answer = useInfiniteQuery({
    queryKey: [
      'workflow-answer',
      api.workspaceId,
      run.request.scope.userId,
      run.request.scope.conversationId,
      run.request.id,
      stepId,
    ],
    enabled: open,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.request<{ text: string; nextOffset: number | null }>(
        `conversations/${encodeURIComponent(run.request.scope.conversationId)}/workflow-runs/answer`,
        { runId: run.request.id, stepId, offset: pageParam },
        'POST',
        { signal },
      ),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  })
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Answer</summary>
      {answer.error ? (
        <p role="alert">
          Could not read this answer.{' '}
          <button type="button" onClick={() => void answer.refetch()}>
            Retry
          </button>
        </p>
      ) : answer.data ? (
        <MessageMarkdown>
          {answer.data.pages.map((page) => page.text).join('')}
        </MessageMarkdown>
      ) : open ? (
        <LoadingState>Loading answer…</LoadingState>
      ) : null}
      {answer.hasNextPage && (
        <button
          type="button"
          disabled={answer.isFetchingNextPage}
          onClick={() => void answer.fetchNextPage()}
        >
          Read more
        </button>
      )}
    </details>
  )
}
export function WorkflowRunEvidence({
  detail,
}: {
  detail: WorkflowRunInspection
}) {
  const { run, orchestration } = detail
  const terminal = ['completed', 'failed', 'cancelled'].includes(
    detail.summary.status,
  )
  return (
    <div className="workflow-evidence">
      {detail.usage && (
        <p>
          Step cost:{' '}
          {detail.usage.totals.pricedRecords
            ? `$${detail.usage.totals.usd.toFixed(6)}${detail.usage.totals.estimated ? ' estimated' : ''}`
            : 'unavailable'}
          {detail.usage.missingSteps > 0 ||
          detail.usage.totals.unavailable > 0 ||
          detail.usage.runningSteps > 0
            ? ' · Incomplete accounting'
            : ''}
          {' · Excludes the launch conversation'}
        </p>
      )}
      {orchestration.platformUnavailable && (
        <p role="status">Could not check background progress.</p>
      )}
      {orchestration.needsAttention && (
        <p role="status">
          {terminal
            ? 'The background runner reported a problem.'
            : 'This workflow needs attention.'}
        </p>
      )}
      {orchestration.launchState === 'not_requested' && <p>Not started.</p>}
      {orchestration.launchState === 'pending' && (
        <p>
          Waiting to start
          {orchestration.nextAttemptAt
            ? ` · Next attempt ${new Date(orchestration.nextAttemptAt).toLocaleTimeString()}`
            : ''}
        </p>
      )}
      <ol>
        {run.steps.map((step) => (
          <li key={step.id}>
            <div>
              <span>
                {run.request.definition.steps.find(
                  (item) => item.id === step.id,
                )?.name ?? step.id}
              </span>
              <span>{labels[step.status]}</span>
            </div>
            {step.result?.status === 'completed' && (
              <WorkflowAnswer run={run} stepId={step.id} />
            )}
            {step.result?.status === 'completed' && (
              <WorkflowFiles run={run} stepId={step.id} />
            )}
            {step.result && step.result.status !== 'completed' && (
              <p>{step.result.reason}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
function WorkflowHistoryItem({
  item,
  path,
  queryKey,
}: {
  item: WorkflowRunSummary
  path: string
  queryKey: readonly unknown[]
}) {
  const api = useWorkspaceApi()
  const [open, setOpen] = useState(false)
  const client = useQueryClient()
  const summaryRef = useRef<HTMLElement>(null)
  const stopRef = useRef<HTMLDivElement>(null)
  const stop = useMutation({
    mutationFn: () =>
      api.request(`${path}/${encodeURIComponent(item.id)}/cancel`, {}),
    onSuccess: () => {
      if (stopRef.current?.contains(document.activeElement))
        summaryRef.current?.focus()
    },
    onSettled: () => client.invalidateQueries({ queryKey }),
  })
  const detail = useQuery({
    queryKey: [...queryKey, item.id],
    enabled: open,
    queryFn: ({ signal }) =>
      api.request<WorkflowRunInspection>(
        `${path}/${encodeURIComponent(item.id)}`,
        undefined,
        'GET',
        { signal },
      ),
    refetchInterval:
      open && !['completed', 'failed', 'cancelled'].includes(item.status)
        ? 5000
        : false,
  })
  const summary =
    detail.data && detail.data.summary.updatedAt >= item.updatedAt
      ? detail.data.summary
      : item
  const terminal = ['completed', 'failed', 'cancelled'].includes(summary.status)
  return (
    <details
      className="workflow-history-item"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary ref={summaryRef}>
        <span>
          <strong>{item.name}</strong>
          <time dateTime={new Date(item.createdAt).toISOString()}>
            {new Date(item.createdAt).toLocaleString()}
          </time>
        </span>
        <span>
          {!terminal && detail.data?.orchestration.needsAttention
            ? 'Needs attention'
            : labels[summary.status]}{' '}
          · {summary.completedSteps}/{summary.totalSteps}
        </span>
      </summary>
      {open &&
        (detail.error ? (
          <p role="alert">
            Could not load this workflow.{' '}
            <button type="button" onClick={() => void detail.refetch()}>
              Retry
            </button>
          </p>
        ) : detail.data ? (
          <WorkflowRunEvidence detail={detail.data} />
        ) : (
          <LoadingState>Loading workflow…</LoadingState>
        ))}
      {open && !terminal && (
        <div className="workflow-stop" ref={stopRef}>
          <IconButton
            label={
              stop.isPending
                ? 'Stopping workflow'
                : stop.isError
                  ? 'Retry stopping workflow'
                  : 'Stop workflow'
            }
            disabled={stop.isPending}
            onClick={() => stop.mutate()}
          >
            <Square size={14} />
          </IconButton>
          {stop.isPending && <span role="status">Stopping…</span>}
          {stop.isSuccess && <span role="status">Stop requested.</span>}
          {stop.isError && (
            <span role="alert">
              Could not confirm the stop. Retry to check again.
            </span>
          )}
        </div>
      )}
    </details>
  )
}
export function WorkflowHistory({
  conversationId,
  userId,
  model,
  readOnly,
}: {
  conversationId: string
  userId: string
  model?: RunModelSelection
  readOnly?: boolean
}) {
  const api = useWorkspaceApi()
  const path = `conversations/${encodeURIComponent(conversationId)}/workflow-runs`
  const client = useQueryClient()
  const key = [
    'workflow-runs',
    api.workspaceId,
    userId,
    conversationId,
  ] as const
  type Cursor = { createdAt: number; id: string }
  const list = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as Cursor | undefined,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({ limit: '10' })
      if (pageParam) {
        query.set('afterTime', String(pageParam.createdAt))
        query.set('afterId', pageParam.id)
      }
      return api.request<{ items: WorkflowRunSummary[]; nextAfter?: Cursor }>(
        `${path}?${query}`,
        undefined,
        'GET',
        { signal },
      )
    },
    getNextPageParam: (page) => page.nextAfter,
    refetchInterval: 10000,
  })
  const items = list.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <section className="workflow-history">
      <header>
        <h3>Workflows</h3>
        <IconButton
          label="Refresh workflows"
          disabled={list.isFetching}
          onClick={() => {
            void list.refetch()
            void client.invalidateQueries({
              queryKey: [
                'workflow-definitions',
                api.workspaceId,
                userId,
                conversationId,
              ],
            })
          }}
        >
          <RefreshCw size={14} />
        </IconButton>
      </header>
      <WorkflowStart
        key={JSON.stringify([api.workspaceId, userId, conversationId])}
        conversationId={conversationId}
        userId={userId}
        model={model}
        readOnly={readOnly}
      />
      {list.error ? (
        <p role="alert">Could not load workflows.</p>
      ) : !list.data ? (
        <LoadingState>Loading workflows…</LoadingState>
      ) : !items.length ? (
        <p>No workflow runs yet.</p>
      ) : (
        items.map((item) => (
          <WorkflowHistoryItem
            key={item.id}
            item={item}
            path={path}
            queryKey={key}
          />
        ))
      )}
      {list.hasNextPage && (
        <button
          type="button"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          Load more
        </button>
      )}
    </section>
  )
}
