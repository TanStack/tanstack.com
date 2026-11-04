import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ConversationDestination } from '../core/conversation-destination'
import type { RetryAttemptView } from '../core/conversation-retry'
import { useWorkspaceApi } from './WorkspaceApi'
import { RetryComposer } from './RetryComposer'
import type { ComposerFocusHandoff } from './composer-focus'
import type { usePendingSend } from './usePendingSend'
import type { RetryDraftEditor } from '../core/retry-draft-editor'
import './retry.css'

export function RetryBranch({
  destination,
  attemptId,
  editing,
  readOnly,
  visible,
  onSent,
  pending,
  onEditor,
  originMissing = false,
  resetConfirmed = false,
}: {
  destination: ConversationDestination
  attemptId: string
  editing: boolean
  readOnly: boolean
  visible: boolean
  onSent: (focus?: ComposerFocusHandoff) => void
  pending: ReturnType<typeof usePendingSend>
  onEditor: (editor: RetryDraftEditor | null) => void
  originMissing?: boolean
  resetConfirmed?: boolean
}) {
  const { request } = useWorkspaceApi()
  const attempt = useQuery({
    queryKey: [
      'retry-attempt',
      destination.userId,
      destination.workspaceId,
      destination.conversationId,
      attemptId,
    ],
    queryFn: () => request<RetryAttemptView>(`retries/${attemptId}`),
    refetchOnMount: 'always',
    retry: false,
  })
  // Never seed from a previous mount's stale cache after a reset or accepted send.
  const view =
    attempt.isFetchedAfterMount && !attempt.error ? attempt.data : undefined
  const exact =
    view?.attemptId === attemptId &&
    view.target?.botId === destination.botId &&
    view.target?.conversationId === destination.conversationId
  const [retainedView, setRetainedView] = useState<RetryAttemptView>()
  const readyView = exact && view.status === 'ready' ? view : undefined
  useEffect(() => {
    if (readyView) setRetainedView(readyView)
  }, [readyView])
  // Keep the same editor mounted through query failures and remote resets.
  // Retained data only supplies its local recovery buffer, never send authority.
  const editorView =
    readyView ??
    retainedView ??
    (exact && view.error?.code === 'target_reset' ? view : undefined)
  const unavailable = originMissing
    ? 'This conversation changed. Your retry draft is kept below for recovery.'
    : attempt.error
      ? attempt.error.message
      : !readyView
        ? (view?.error?.message ?? 'This retry cannot be verified right now.')
        : undefined
  return (
    <>
      {!editorView &&
        (attempt.error ? (
          <div className="retry-preparation" role="alert">
            <span>{attempt.error.message}</span>
            <button
              type="button"
              className="quiet-button"
              onClick={() => void attempt.refetch()}
            >
              Check again
            </button>
          </div>
        ) : !view ? (
          <p role="status">Opening retry…</p>
        ) : !exact ? (
          <p role="alert">This retry does not match the open conversation.</p>
        ) : view.status !== 'ready' ? (
          <div className="retry-preparation">
            <span role="status">
              {view.error?.message ??
                'This retry is not ready yet. Resume preparation from the original request.'}
            </span>
            <button
              type="button"
              className="quiet-button"
              onClick={() => void attempt.refetch()}
            >
              Check again
            </button>
          </div>
        ) : null)}
      {editorView && (attempt.error || !readyView) && (
        <div className="retry-preparation">
          <button
            type="button"
            className="quiet-button"
            onClick={() => void attempt.refetch()}
          >
            Check again
          </button>
        </div>
      )}
      {editing && editorView && (
        <RetryComposer
          destination={destination}
          attempt={editorView}
          unavailable={unavailable}
          canExitUnavailable={
            resetConfirmed || (exact && view.error?.code === 'target_reset')
          }
          readOnly={readOnly || attempt.isFetching}
          visible={visible}
          onSent={onSent}
          pending={pending}
          onEditor={onEditor}
        />
      )}
    </>
  )
}
