import { LoadingState } from './ui/LoadingState'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Popover } from '@base-ui/react/popover'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUp,
  Check,
  Copy,
  Download,
  LoaderCircle,
  RotateCcw,
  X,
} from 'lucide-react'
import type { ConversationDestination } from '../core/conversation-destination'
import type { RetryAttemptView } from '../core/conversation-retry'
import {
  referenceKey,
  type MessageReference,
  type ReferenceInput,
} from '../core/message-references'
import { isTextFile, isPreviewImage } from '../core/files'
import type { RunModelCatalog, RunModelSelection } from '../core/run-model'
import { useRetryDraft } from './useRetryDraft'
import {
  retryDraftSendInput,
  type RetryDraftEditor,
} from '../core/retry-draft-editor'
import { useRetryAttachments } from './useRetryAttachments'
import type { usePendingSend } from './usePendingSend'
import { PendingSendStore } from '../core/send-receipt'
import { useWorkspaceApi } from './WorkspaceApi'
import { resolveRunModelChoice } from './useRunModel'
import {
  ComposerAttachments,
  composerSketchDisabledReason,
} from './ComposerAttachments'
import { ComposerAddButton, ComposerReferences } from './ComposerReferences'
import { RunModelPicker } from './RunModelPicker'
import {
  addComposerReference,
  findReferenceTrigger,
  removeReferenceTrigger,
  type ReferenceTrigger,
} from './useComposerReferences'
import { IconButton } from './IconButton'
import { RetryReturn } from './RetryReturn'
import {
  captureComposerFocus,
  type ComposerFocusHandoff,
} from './composer-focus'
import './retry-composer.css'

export function retryAttemptMatchesDestination(
  attempt: RetryAttemptView,
  destination: ConversationDestination,
) {
  return (
    attempt.status === 'ready' &&
    attempt.target?.botId === destination.botId &&
    attempt.target.conversationId === destination.conversationId
  )
}

export function RetryComposer({
  destination,
  attempt,
  pending,
  onSent,
  onDismiss,
  onEditor,
  unavailable,
  canExitUnavailable = false,
  readOnly = false,
  visible = true,
}: {
  destination: ConversationDestination
  attempt: RetryAttemptView
  pending: ReturnType<typeof usePendingSend>
  onSent?: (focus?: ComposerFocusHandoff) => void
  onDismiss?: () => void
  onEditor?: (editor: RetryDraftEditor | null) => void
  unavailable?: string
  canExitUnavailable?: boolean
  readOnly?: boolean
  visible?: boolean
}) {
  const draft = useRetryDraft(destination, attempt)
  const { request } = useWorkspaceApi()
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [mention, setMention] = useState<ReferenceTrigger | null>(null)
  const [referencePicker] = useState(() => Popover.createHandle())
  const textarea = useRef<HTMLTextAreaElement>(null)
  const composer = useRef<HTMLElement>(null)
  const sendFocus = useRef<ComposerFocusHandoff | undefined>(undefined)
  const focused = useRef(false)
  const sent = useRef(false)
  const reconciling = useRef(false)
  const matching = retryAttemptMatchesDestination(attempt, destination)
  const consumed = draft.document?.consumed
  const accepted = !!attempt.submittedMessageId || !!consumed
  const returnState = useRef({ pending, accepted, visible })
  returnState.current = { pending, accepted, visible }
  const canLeaveUnavailable = canExitUnavailable || accepted
  const locked =
    !!unavailable ||
    readOnly ||
    !visible ||
    !matching ||
    !draft.ready ||
    !draft.draft ||
    pending.busy ||
    !!pending.pending ||
    !pending.ready ||
    accepted
  const attachments = useRetryAttachments(
    draft.editor,
    draft,
    destination,
    locked,
  )
  const query = useQuery({
    queryKey: [
      'run-model-options',
      destination.workspaceId,
      destination.userId,
    ],
    queryFn: () => request<RunModelCatalog>('model-options'),
    staleTime: 30000,
    refetchOnMount: 'always',
    retry: false,
  })
  const selection = draft.draft?.runModel
  const resolved = resolveRunModelChoice(selection, query.data)
  const catalogReady =
    query.isFetchedAfterMount && !query.isError && !query.isFetching
  const modelError =
    query.error?.message ?? (!query.isPending ? resolved.error : '')
  const model = {
    selection,
    catalog: query.data,
    catalogReady,
    choice: resolved.choice,
    loading: query.isPending || !query.isFetchedAfterMount,
    refreshing: query.isFetching,
    valid: catalogReady && !modelError,
    error: modelError,
    refetch: query.refetch,
    select: (next: RunModelSelection) => {
      if (
        locked ||
        !catalogReady ||
        resolveRunModelChoice(next, query.data).error
      )
        return false
      void draft.editor.change((value) => ({ ...value, runModel: next }))
      return true
    },
  }
  const references = {
    items: draft.draft?.references ?? [],
    busy: draft.saving,
    error: '',
    hasReferences: !!draft.draft?.references.length,
    add: (reference: MessageReference) => {
      if (locked) return Promise.resolve(false)
      return draft.editor.change((value) => ({
        ...value,
        references: addComposerReference(value.references, reference),
      }))
    },
    remove: (reference: ReferenceInput) =>
      locked
        ? Promise.resolve(false)
        : draft.editor.change((value) => ({
            ...value,
            references: value.references.filter(
              (item) => referenceKey(item) !== referenceKey(reference),
            ),
          })),
    clear: () =>
      locked
        ? Promise.resolve(false)
        : draft.editor.change((value) => ({ ...value, references: [] })),
  }
  const fileCount =
    attachments.items.length +
    references.items.filter((item) => item.kind === 'file').length
  const sketchDisabledReason = composerSketchDisabledReason({
    readOnly,
    locked,
    fileCount,
    model,
  })
  const unsupportedFile = draft.draft?.attachments.find((file) =>
    isTextFile(file.mediaType)
      ? false
      : isPreviewImage(file.mediaType)
        ? !model.choice?.attachments.includes('image')
        : file.mediaType === 'application/pdf'
          ? !model.choice?.attachments.includes('pdf')
          : true,
  )
  const hasContent =
    !!draft.draft?.text.trim() ||
    !!draft.draft?.attachments.length ||
    references.items.some((item) => item.kind === 'file')
  const canSend =
    !locked &&
    !draft.error &&
    !draft.dirty &&
    !draft.saving &&
    model.valid &&
    attachments.valid &&
    !unsupportedFile &&
    hasContent
  const laterEdits =
    !!consumed &&
    (draft.dirty || (draft.document?.revision ?? 0) > consumed.draftRevision)

  const beginFocusHandoff = () => {
    sendFocus.current?.cancel()
    sendFocus.current = captureComposerFocus(
      composer.current,
      visible && !readOnly,
    )
  }
  const finishEditing = () => {
    const handoff = sendFocus.current
    sendFocus.current = undefined
    if (onSent) onSent(handoff)
    else handoff?.cancel()
  }
  useEffect(() => {
    if (!visible || readOnly || unavailable || pending.error) {
      sendFocus.current?.cancel()
      sendFocus.current = undefined
    }
  }, [visible, readOnly, unavailable, pending.error])
  useEffect(() => () => sendFocus.current?.cancel(), [])

  useEffect(() => {
    onEditor?.(draft.editor)
    return () => onEditor?.(null)
  }, [draft.editor, onEditor])

  useEffect(() => {
    if (visible && !locked && !focused.current && textarea.current) {
      textarea.current.focus()
      focused.current = true
    }
  }, [visible, locked])
  useEffect(() => {
    if (
      unavailable ||
      !matching ||
      !draft.ready ||
      !pending.ready ||
      pending.pending ||
      pending.busy ||
      sent.current ||
      reconciling.current
    )
      return
    if (attempt.submittedMessageId && draft.document && !consumed) {
      if (attempt.submittedDraftRevision === undefined) {
        setError(
          'The accepted request revision is unavailable. Check the attempt again.',
        )
        return
      }
      reconciling.current = true
      void draft.editor
        .consume({
          messageId: attempt.submittedMessageId,
          draftRevision: attempt.submittedDraftRevision,
        })
        .catch((cause) =>
          setError(
            cause instanceof Error
              ? cause.message
              : 'The accepted draft could not be reconciled.',
          ),
        )
        .finally(() => {
          reconciling.current = false
        })
      return
    }
    if (
      !draft.error &&
      !draft.dirty &&
      !laterEdits &&
      (consumed || (attempt.submittedMessageId && !draft.document))
    ) {
      sent.current = true
      finishEditing()
    }
  }, [
    unavailable,
    matching,
    draft.ready,
    draft.document,
    draft.dirty,
    draft.error,
    consumed,
    laterEdits,
    pending.ready,
    pending.pending,
    pending.busy,
    attempt.submittedMessageId,
    attempt.submittedDraftRevision,
    onSent,
    draft.editor,
  ])
  async function send(event?: FormEvent) {
    event?.preventDefault()
    if (
      unavailable ||
      readOnly ||
      !visible ||
      accepted ||
      !matching ||
      pending.busy ||
      !pending.ready
    )
      return
    beginFocusHandoff()
    if (pending.pending) {
      await pending.retry()
      return
    }
    const saved = await draft.editor.flush()
    if (
      !saved ||
      !model.valid ||
      !attachments.valid ||
      unsupportedFile ||
      !hasContent ||
      saved.draft.pendingAttachments?.length
    ) {
      sendFocus.current?.cancel()
      sendFocus.current = undefined
      return
    }
    setError('')
    try {
      await pending.submit(retryDraftSendInput(saved))
    } catch (cause) {
      sendFocus.current?.cancel()
      sendFocus.current = undefined
      setError(
        cause instanceof Error
          ? cause.message
          : 'The revised request could not be sent.',
      )
    }
  }
  const downloadDraft = () => {
    if (!draft.draft) return
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(draft.draft, null, 2)], {
        type: 'application/json',
      }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'gum-unsent-draft.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <section
      ref={composer}
      className="retry-composer"
      aria-label="Edit request in new branch"
      hidden={!visible}
    >
      <div className="retry-composer-heading">
        <span>
          {accepted
            ? laterEdits
              ? 'Sent. Your later edits are kept below.'
              : 'Confirming sent request…'
            : 'Edit request'}
        </span>
        {!accepted && (
          <RetryReturn
            destination={destination}
            expectedMessageId={attempt.evidence?.id}
            visible={visible}
            disabledReason={
              !pending.ready || pending.busy || pending.pending
                ? 'Resolve the pending send before returning.'
                : !draft.ready || !draft.draft
                  ? 'Wait for the saved request to load.'
                  : attachments.busy
                    ? 'Wait for the files to finish before returning.'
                    : undefined
            }
            saveDraft={async () => {
              const available = () => {
                const current = returnState.current
                return (
                  current.visible &&
                  !current.accepted &&
                  current.pending.ready &&
                  !current.pending.busy &&
                  !current.pending.pending &&
                  !new PendingSendStore(
                    localStorage,
                    destination.compatibility.sendScope,
                  ).read()
                )
              }
              if (!available()) return false
              const saved = await draft.editor.flush()
              return !!saved && available()
            }}
            onError={setError}
          />
        )}
        {onDismiss && (
          <IconButton
            label="Cancel editing"
            disabled={
              pending.busy ||
              !!pending.pending ||
              draft.dirty ||
              draft.saving ||
              attachments.busy
            }
            onClick={onDismiss}
          >
            <X size={16} aria-hidden />
          </IconButton>
        )}
      </div>
      {!matching && !unavailable && (
        <p role="alert">This retry does not match the current conversation.</p>
      )}
      {unavailable && <p role="alert">{unavailable}</p>}
      {unavailable && draft.ready && !draft.draft && !draft.error && (
        <div className="retry-draft-recovery">
          <span>No retry draft is saved on this device.</span>
          {canLeaveUnavailable && (
            <button
              type="button"
              className="quiet-button"
              disabled={!pending.ready || pending.busy || !!pending.pending}
              onClick={() => {
                beginFocusHandoff()
                finishEditing()
              }}
            >
              Continue
            </button>
          )}
        </div>
      )}
      {!draft.ready && <LoadingState>Loading saved request…</LoadingState>}
      {(error || pending.error || draft.error) && (
        <p role="alert" className="error">
          {error || pending.error || draft.error}
        </p>
      )}
      {(((draft.error || unavailable) && draft.draft) ||
        (consumed && draft.dirty)) && (
        <div className="retry-draft-recovery">
          {!consumed && (draft.dirty || draft.error) && (
            <button
              type="button"
              className="quiet-button"
              disabled={draft.saving}
              onClick={() => void draft.editor.keepLocal()}
            >
              Save my draft
            </button>
          )}
          {(draft.dirty || draft.error) && (
            <button
              type="button"
              className="quiet-button"
              disabled={draft.saving}
              onClick={() => void draft.editor.useSaved()}
            >
              {consumed
                ? 'Discard local edits and use saved draft'
                : 'Use saved draft'}
            </button>
          )}
          <IconButton
            label={copied ? 'Copied draft text' : 'Copy draft text'}
            onClick={() => {
              void navigator.clipboard
                .writeText(draft.draft!.text)
                .then(() => setCopied(true))
                .catch(() =>
                  setError(
                    'The text could not be copied. Select it and copy manually.',
                  ),
                )
            }}
          >
            {copied ? (
              <Check size={16} aria-hidden />
            ) : (
              <Copy size={16} aria-hidden />
            )}
          </IconButton>
          <IconButton
            label="Download unsaved draft with file and reference identities"
            onClick={downloadDraft}
          >
            <Download size={16} aria-hidden />
          </IconButton>
          {draft.error && (
            <details>
              <summary>Saved draft</summary>
              <pre>
                {draft.conflict?.draft.text ??
                  'The saved draft could not be read.'}
              </pre>
            </details>
          )}
          {unavailable && canLeaveUnavailable && (
            <button
              type="button"
              className="quiet-button"
              disabled={
                !pending.ready ||
                draft.dirty ||
                draft.saving ||
                pending.busy ||
                !!pending.pending
              }
              onClick={() => {
                beginFocusHandoff()
                finishEditing()
              }}
            >
              Continue without this retry
            </button>
          )}
        </div>
      )}
      {draft.error && !draft.draft && (
        <button type="button" onClick={() => void draft.reload()}>
          Try loading again
        </button>
      )}
      {!pending.busy && (pending.pending || !pending.ready) && (
        <div className="retry-draft-recovery">
          <span role="status">
            {pending.pending
              ? 'Send not confirmed.'
              : 'Send recovery unavailable.'}
          </span>
          <button
            type="button"
            className="quiet-button"
            onClick={() => void pending.check()}
          >
            Check again
          </button>
        </div>
      )}
      {draft.draft && (
        <form
          className="composer"
          onSubmit={(event) => void send(event)}
          onDrop={attachments.onDrop}
          onDragOver={attachments.onDragOver}
          onPaste={attachments.onPaste}
        >
          <ComposerAttachments
            attachments={attachments}
            disabled={locked}
            hidden={!!pending.pending}
            sketchDisabledReason={sketchDisabledReason}
            renderPicker={(onUpload, onSketch) => (
              <ComposerReferences
                picker={referencePicker}
                references={references}
                userId={destination.userId}
                botId={destination.botId}
                destination={destination}
                disabled={locked}
                uploadedFileIds={attachments.items.map((file) => file.id)}
                onUpload={onUpload}
                onSketch={onSketch}
                sketchDisabledReason={sketchDisabledReason}
                mention={mention}
                composerInput={textarea}
                onCloseMention={() => {
                  setMention(null)
                  textarea.current?.focus()
                }}
                onSelected={(trigger) => {
                  const removed = trigger
                    ? removeReferenceTrigger(
                        textarea.current?.value ?? draft.draft!.text,
                        trigger,
                      )
                    : {
                        text: textarea.current?.value ?? draft.draft!.text,
                        caret: null,
                      }
                  if (trigger)
                    void draft.editor.change((value) => ({
                      ...value,
                      text: removed.text,
                    }))
                  requestAnimationFrame(() => {
                    textarea.current?.focus()
                    if (removed.caret !== null)
                      textarea.current?.setSelectionRange(
                        removed.caret,
                        removed.caret,
                      )
                  })
                }}
              />
            )}
          />
          <textarea
            ref={textarea}
            aria-label="Revised request"
            rows={3}
            maxLength={12000}
            readOnly={locked}
            value={
              unavailable
                ? draft.draft.text
                : (pending.pending?.payload.text ?? draft.draft.text)
            }
            onChange={(event) => {
              const text = event.target.value
              void draft.editor.change((value) => ({ ...value, text }))
              if (!(event.nativeEvent as InputEvent).isComposing)
                setMention(
                  findReferenceTrigger(
                    text,
                    event.target.selectionStart,
                    event.target.selectionEnd,
                  ),
                )
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <div className="composer-toolbar">
            <ComposerAddButton handle={referencePicker} disabled={locked} />
            <RunModelPicker
              model={model}
              selection={
                pending.pending
                  ? (pending.pending.payload.runModel ?? null)
                  : model.selection
              }
              disabled={locked}
              frozen={!!pending.pending || accepted}
            />
            {draft.saving && <span role="status">Saving…</span>}
            {laterEdits ? (
              <>
                <IconButton
                  label={copied ? 'Copied saved text' : 'Copy saved text'}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(draft.draft!.text)
                      .then(() => setCopied(true))
                      .catch(() =>
                        setError(
                          'The text could not be copied. Select it and copy manually.',
                        ),
                      )
                  }}
                >
                  {copied ? (
                    <Check size={16} aria-hidden />
                  ) : (
                    <Copy size={16} aria-hidden />
                  )}
                </IconButton>
                <IconButton
                  label="Download saved draft with file and reference identities"
                  onClick={downloadDraft}
                >
                  <Download size={16} aria-hidden />
                </IconButton>
                <button
                  type="button"
                  className="quiet-button"
                  disabled={
                    !pending.ready ||
                    !!pending.pending ||
                    pending.busy ||
                    draft.saving ||
                    draft.dirty
                  }
                  onClick={() => {
                    if (
                      !pending.ready ||
                      pending.pending ||
                      pending.busy ||
                      draft.saving ||
                      draft.dirty
                    )
                      return
                    beginFocusHandoff()
                    sent.current = true
                    finishEditing()
                  }}
                >
                  Continue
                </button>
              </>
            ) : (
              !accepted && (
                <button
                  type="submit"
                  className="send"
                  aria-label={
                    pending.pending
                      ? 'Retry sending revised request'
                      : 'Send revised request'
                  }
                  disabled={
                    pending.pending
                      ? pending.busy ||
                        !pending.ready ||
                        readOnly ||
                        !!unavailable
                      : !canSend
                  }
                >
                  {pending.busy ? (
                    <LoaderCircle
                      size={20}
                      className="animate-spin"
                      aria-hidden
                    />
                  ) : pending.pending ? (
                    <RotateCcw size={20} aria-hidden />
                  ) : (
                    <ArrowUp size={20} aria-hidden />
                  )}
                </button>
              )
            )}
          </div>
          {unsupportedFile && !accepted && (
            <p role="alert" className="composer-attachment-error">
              Choose a compatible model or remove {unsupportedFile.name} before
              sending.
            </p>
          )}
        </form>
      )}
    </section>
  )
}
