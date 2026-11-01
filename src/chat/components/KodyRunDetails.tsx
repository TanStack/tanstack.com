import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { kodyRunSchema } from '../core/kody-run'
import { useWorkspaceApi } from './WorkspaceApi'

export function KodyRunDetails({
  runId,
  summary,
  className = '',
  initiallyOpen = false,
}: {
  runId: string
  summary?: ReactNode
  className?: string
  initiallyOpen?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const { request, workspaceId } = useWorkspaceApi()
  const queries = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function triage(value: 'open' | 'ignored' | 'resolved') {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await request(`kody/runs/${runId}/triage`, { triage: value }, 'POST')
      await Promise.all([
        queries.invalidateQueries({
          queryKey: ['kody-run', workspaceId, runId],
        }),
        queries.invalidateQueries({
          queryKey: ['kody-run-history', workspaceId],
        }),
        queries.invalidateQueries({ queryKey: ['kody-account'] }),
      ])
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'The change could not be confirmed.',
      )
    } finally {
      setSaving(false)
    }
  }
  const run = useQuery({
    queryKey: ['kody-run', workspaceId, runId],
    queryFn: async () =>
      kodyRunSchema.parse(await request(`kody/runs/${runId}`)),
    enabled: open,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  })
  return (
    <details
      className={`kody-run-details ${className}`.trim()}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <ChevronRight size={13} aria-hidden="true" />
        {summary ?? 'Kody run'}
      </summary>
      <div className="kody-run-body">
        <code>{runId}</code>
        {run.isPending && <p>Checking Kody…</p>}
        {run.isError && <p role="alert">{run.error.message}</p>}
        {run.data && (
          <>
            {summary ? (
              run.data.durationMs != null && <p>{run.data.durationMs} ms</p>
            ) : (
              <>
                <p>
                  {run.data.status}
                  {run.data.durationMs != null
                    ? ` · ${run.data.durationMs} ms`
                    : ''}
                </p>
                {run.data.name && <p>{run.data.name}</p>}
              </>
            )}
            {run.data.packageId && <p>Package: {run.data.packageId}</p>}
            {run.data.publishedCommit && (
              <p>Revision: {run.data.publishedCommit}</p>
            )}
            {run.data.errorMessage && (
              <pre>
                {run.data.errorName ? `${run.data.errorName}: ` : ''}
                {run.data.errorMessage}
              </pre>
            )}
            {run.data.status === 'error' && (
              <div className="home-page-actions">
                <span>{run.data.errorTriage ?? 'open'}</span>
                {(['resolved', 'ignored', 'open'] as const)
                  .filter(
                    (value) => value !== (run.data?.errorTriage ?? 'open'),
                  )
                  .map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={saving}
                      onClick={() => void triage(value)}
                    >
                      {value === 'open'
                        ? 'Reopen'
                        : value === 'resolved'
                          ? 'Mark resolved'
                          : 'Ignore'}
                    </button>
                  ))}
                {error && <p role="alert">{error}</p>}
              </div>
            )}
            {run.data.logs.length > 0 && (
              <>
                <div className="tool-detail-label">
                  Logs ({run.data.logs.length} of {run.data.logCount})
                </div>
                <pre>
                  {run.data.logs
                    .map((log) => `${log.level}: ${log.message}`)
                    .join('\n')}
                </pre>
              </>
            )}
          </>
        )}
      </div>
    </details>
  )
}
