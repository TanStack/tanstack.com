import { LoadingState } from './ui/LoadingState'
import { SelectField } from './SelectField'
import { useId, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
import {
  createExecutionHttp,
  ExecutionHttpError,
} from '../client/execution-http'
import { readExecutionHistory } from '../client/execution-history'
import { executionOwnerKey } from '../client/execution-owner'
import type {
  ExecutionIdentity,
  ExecutionSession,
} from '../core/execution-sessions'
import { useExecutionOwnerViews } from './execution-context'
import {
  ExecutionEvidence,
  type ExecutionEvidenceData,
} from './ExecutionSessionEvidence'
import { IconButton } from './IconButton'

function sessionLabel(session: ExecutionSession) {
  return `${new Date(session.createdAt).toLocaleString()} · ${session.status.replaceAll('_', ' ')} · ${session.id.slice(0, 8)}`
}

export function historyAccessDenied(...errors: unknown[]) {
  return errors.some(
    (error) =>
      error instanceof ExecutionHttpError &&
      error.status !== null &&
      [401, 403, 404].includes(error.status),
  )
}

/** Separate query state, with no execution owner or bridge methods. */
export function ExecutionSessionHistory({
  identity,
  active,
  sessionId,
  onSelect,
  children,
}: {
  identity: ExecutionIdentity
  active: boolean
  sessionId?: string
  onSelect: (id: string | undefined) => void
  children: ReactNode
}) {
  const pickerId = useId()
  const key = executionOwnerKey(identity)
  const http = useMemo(() => createExecutionHttp(identity), [key])
  const views = useExecutionOwnerViews()
  const currentId = views.find((view) => view.key === key)?.snapshot?.session
    ?.id
  const list = useQuery({
    queryKey: ['execution-history', key, currentId ?? null],
    queryFn: ({ signal }) => http.history(signal),
    enabled: active,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const record = useQuery({
    queryKey: ['execution-history-session', key, sessionId ?? null],
    queryFn: ({ signal }) =>
      readExecutionHistory(http, identity, sessionId!, signal),
    enabled: active && !!sessionId,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  // Never display cached evidence after a failed authorization or while it is
  // being revalidated. Query keys include every identity field and the session.
  const accessDenied = historyAccessDenied(list.error, record.error)
  const sessions =
    accessDenied || list.isError || list.isFetching
      ? []
      : (list.data?.sessions ?? [])
  const data =
    accessDenied || record.isError || record.isFetching
      ? undefined
      : record.data
  const choices = sessions.filter(
    (session) => session.id !== currentId || session.id === sessionId,
  )
  const loading = list.isFetching || (!!sessionId && record.isFetching)
  return (
    <>
      <div className="execution-history-picker">
        <label htmlFor={pickerId}>
          Workspace session
          <SelectField
            id={pickerId}
            value={sessionId ?? ''}
            onValueChange={(value) => onSelect(value || undefined)}
            items={[
              {
                value: '',
                label: 'Current workspace',
              },
              ...(sessionId &&
              !choices.some((session) => session.id === sessionId)
                ? [
                    {
                      value: sessionId,
                      label: <>Saved session {sessionId.slice(0, 8)}</>,
                    },
                  ]
                : []),
              ...choices.map((session) => ({
                value: session.id,
                label: sessionLabel(session),
              })),
            ]}
          />
        </label>
        <IconButton
          label="Refresh workspace history"
          disabled={loading}
          onClick={() => {
            void list.refetch()
            if (sessionId) void record.refetch()
          }}
        >
          <RotateCw size={15} />
        </IconButton>
      </div>
      {list.isError && (
        <p className="execution-history-error" role="alert">
          Workspace history could not be loaded. Refresh to try again.
        </p>
      )}
      <div hidden={!!sessionId}>{children}</div>
      {sessionId && (
        <section
          className="execution-panel execution-panel-tab"
          aria-label="Saved workspace session"
        >
          {accessDenied || record.isError ? (
            <p role="alert">
              This workspace session could not be loaded. It may be unavailable
              or your access may have changed.
            </p>
          ) : !data ? (
            <LoadingState>Loading saved workspace…</LoadingState>
          ) : (
            <RecordedExecutionSession evidence={data} />
          )}
        </section>
      )}
    </>
  )
}

export function RecordedExecutionSession({
  evidence,
}: {
  evidence: ExecutionEvidenceData
}) {
  const session = evidence.snapshot?.session
  if (!session) return null
  const snapshots = evidence.snapshot?.savedSnapshots ?? []
  return (
    <>
      <div className="execution-panel-heading">
        <h3>Saved workspace</h3>
        <small>Read only</small>
      </div>
      <p>Recorded state: {session.status.replaceAll('_', ' ')}</p>
      <small>
        <time dateTime={new Date(session.createdAt).toISOString()}>
          {new Date(session.createdAt).toLocaleString()}
        </time>
      </small>
      {!!evidence.snapshot?.processes.length && (
        <section
          className="execution-panel-processes"
          aria-label="Recorded processes"
        >
          <h4>Processes</h4>
          <ul>
            {evidence.snapshot.processes.map((process) => (
              <li key={process.id}>
                <div>
                  <strong>Process {process.pid}</strong>
                  <span>Recorded: {process.state}</span>
                  {process.exit && (
                    <small>
                      Exit: {process.exit.exitCode ?? process.exit.signal}
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {snapshots.length > 0 && (
        <section
          className="execution-panel-processes"
          aria-label="Saved workspace snapshots"
        >
          <h4>Snapshots</h4>
          <ul>
            {snapshots.map((snapshot, index) => (
              <li key={snapshot.snapshotId}>
                <div>
                  <strong>Snapshot {index + 1}</strong>
                  <small>
                    {snapshot.state === 'pending'
                      ? 'Saving unconfirmed'
                      : snapshot.state === 'ready'
                        ? 'Ready'
                        : 'Unavailable'}{' '}
                    · {snapshot.byteLength.toLocaleString()} bytes
                  </small>
                  <small>
                    <time dateTime={new Date(snapshot.createdAt).toISOString()}>
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </time>
                  </small>
                  <details>
                    <summary>Snapshot details</summary>
                    <pre>{JSON.stringify(snapshot, null, 2)}</pre>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ExecutionEvidence evidence={evidence} />
    </>
  )
}
