import type { useCloudDraft } from './useCloudDraft'

export function DraftSyncNotice({
  sync,
  kind = 'text',
}: {
  sync?: ReturnType<typeof useCloudDraft>
  kind?: 'text' | 'references' | 'attachments'
}) {
  if (!sync) return null
  if (sync.conflict)
    return (
      <details className="draft-sync-notice">
        <summary>Draft {kind} also changed on another device.</summary>
        <pre>
          {(kind === 'text'
            ? sync.conflict.value
            : describeSelection(sync.conflict.value)) ||
            'The other device cleared this draft.'}
        </pre>
        <button type="button" onClick={() => sync.resolve(false)}>
          Keep this draft
        </button>
        <button type="button" onClick={() => sync.resolve(true)}>
          Use other draft
        </button>
      </details>
    )
  return null
}

function describeSelection(value: string) {
  try {
    return (
      JSON.parse(value || '[]') as Array<{
        name?: string
        reference?: { label?: string; name?: string }
      }>
    )
      .map(
        (item) =>
          item.name ??
          item.reference?.label ??
          item.reference?.name ??
          'Reference',
      )
      .join('\n')
  } catch {
    return 'Saved selection'
  }
}
