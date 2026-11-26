import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { KodyAccount } from '../core/kody-account'
import { kodyJobChangeResultSchema } from '../core/kody-jobs'
import { useWorkspaceApi } from './WorkspaceApi'
import { Button } from './ui/Button'

export function KodyJobControl({
  job,
}: {
  job: KodyAccount['jobs']['items'][number]
}) {
  const { request } = useWorkspaceApi()
  const queries = useQueryClient()
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function change() {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      const result = kodyJobChangeResultSchema.parse(
        await request(`kody/jobs/${encodeURIComponent(job.id)}/enabled`, {
          enabled: !job.enabled,
          expected: {
            enabled: job.enabled,
            sourceId: job.sourceId,
            publishedCommit: job.publishedCommit ?? null,
            updatedAt: job.updatedAt,
          },
        }),
      )
      if (result.id !== job.id || result.enabled !== !job.enabled)
        throw new Error('Kody did not confirm the requested job state.')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'The job state could not be confirmed.',
      )
    } finally {
      await Promise.all([
        queries.invalidateQueries({ queryKey: ['kody-account'] }),
        queries.invalidateQueries({ queryKey: ['home-account-detail'] }),
      ])
      locked.current = false
      setBusy(false)
    }
  }
  return (
    <div className="home-page-actions">
      <Button
        disabled={
          busy || (!job.enabled && (job.expired || job.killSwitchEnabled))
        }
        onClick={() => void change()}
      >
        {busy ? 'Saving…' : job.enabled ? 'Pause job' : 'Resume job'}
      </Button>
      {!job.enabled && (job.expired || job.killSwitchEnabled) && (
        <p>This job is expired or stopped by Kody.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
