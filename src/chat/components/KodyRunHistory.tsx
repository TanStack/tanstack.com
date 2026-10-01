import { useState, type FormEvent } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { z } from 'zod'
import {
  kodyRunHistoryFilterSchema,
  kodyRunHistoryPageSchema,
} from '../core/kody-run-history'
import { useWorkspaceApi } from './WorkspaceApi'
import { KodyRunDetails } from './KodyRunDetails'
import { Button } from './ui/Button'

const surfaceNames: Record<string, string> = {
  execute: 'Code run',
  export: 'Package action',
  subscription: 'Package event',
  app_fetch: 'App request',
  app_realtime: 'Live app request',
  job: 'Scheduled job',
  workflow: 'Workflow',
  retriever: 'Retriever',
  webhook: 'Webhook',
}
const displaySurfaceNames: Record<string, string> = {
  ...surfaceNames,
  skills: 'Skill',
}

function runTime(startedAt: string) {
  const date = new Date(startedAt)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date)
    : startedAt
}

export function KodyRunHistory({ accountScope }: { accountScope: string }) {
  const { request, workspaceId } = useWorkspaceApi()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [surface, setSurface] = useState('')
  const [triage, setTriage] = useState('all')
  const [runIdInput, setRunIdInput] = useState('')
  const [selectedRunId, setSelectedRunId] = useState('')
  const [runIdError, setRunIdError] = useState('')
  const history = useInfiniteQuery({
    queryKey: [
      'kody-run-history',
      workspaceId,
      accountScope,
      status,
      surface,
      triage,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const filter = kodyRunHistoryFilterSchema.parse({
        triage,
        ...(status ? { status } : {}),
        ...(surface ? { surface } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      })
      const params = new URLSearchParams(filter)
      return kodyRunHistoryPageSchema.parse(
        await request(`kody/runs?${params}`),
      )
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: open,
    staleTime: 0,
    retry: false,
  })
  const runs = Array.from(
    new Map(
      history.data?.pages
        .flatMap((page) => page.runs)
        .map((run) => [run.id, run]) ?? [],
    ).values(),
  )
  function findRun(event: FormEvent) {
    event.preventDefault()
    const parsed = z.uuid().safeParse(runIdInput.trim())
    if (!parsed.success) {
      setRunIdError('Enter a valid Kody run ID.')
      return
    }
    setRunIdError('')
    setSelectedRunId(parsed.data)
  }
  return (
    <details
      className="connection-kody-section"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Kody activity</summary>
      {open && (
        <>
          <div className="connection-kody-run-filters">
            <label>
              Error triage
              <select
                value={triage}
                onChange={(event) => {
                  setTriage(event.target.value)
                  if (event.target.value !== 'all') setStatus('error')
                }}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="ignored">Ignored</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value)
                  if (event.target.value !== 'error') setTriage('all')
                }}
              >
                <option value="">All</option>
                <option value="error">Error</option>
                <option value="running">Running</option>
                <option value="success">Success</option>
              </select>
            </label>
            <label>
              Type
              <select
                value={surface}
                onChange={(event) => setSurface(event.target.value)}
              >
                <option value="">All</option>
                {Object.entries(surfaceNames).map(([value, name]) => (
                  <option value={value} key={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <details className="connection-kody-run-find">
            <summary>Find a run by ID</summary>
            <form className="connection-kody-run-lookup" onSubmit={findRun}>
              <label htmlFor="kody-run-id">Run ID</label>
              <input
                id="kody-run-id"
                value={runIdInput}
                onChange={(event) => setRunIdInput(event.target.value)}
                placeholder="Paste a Kody run ID"
              />
              <Button type="submit" size="sm">
                Find
              </Button>
            </form>
            {runIdError && <p role="alert">{runIdError}</p>}
            {selectedRunId && (
              <KodyRunDetails
                key={selectedRunId}
                runId={selectedRunId}
                initiallyOpen
                className="connection-kody-run"
                summary={<strong>Run {selectedRunId}</strong>}
              />
            )}
          </details>
          {history.isPending && <p>Loading Kody activity…</p>}
          {history.isError && <p role="alert">{history.error.message}</p>}
          {runs.map((run) => (
            <KodyRunDetails
              key={run.id}
              runId={run.id}
              className="connection-kody-run"
              summary={
                <>
                  <strong>
                    {run.surface === 'retriever' && run.name === 'skills'
                      ? 'Skill search'
                      : run.name && run.name !== run.surface
                        ? run.name
                        : displaySurfaceNames[run.surface] || run.surface}
                    <time dateTime={run.startedAt}>
                      {runTime(run.startedAt)}
                    </time>
                  </strong>
                  <span>
                    {run.status}
                    {run.errorTriage ? ` · ${run.errorTriage}` : ''}
                  </span>
                </>
              }
            />
          ))}
          {history.isSuccess && runs.length === 0 && !history.hasNextPage && (
            <p>No Kody runs match these filters.</p>
          )}
          {history.hasNextPage && (
            <Button
              type="button"
              size="sm"
              disabled={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              {history.isFetchingNextPage ? 'Loading…' : 'Load older runs'}
            </Button>
          )}
        </>
      )}
    </details>
  )
}
