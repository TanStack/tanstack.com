import { DraftSyncNotice } from './DraftSyncNotice'
import { PendingMessage } from './PendingMessage'
import { usePaletteScope } from './palette-context'
import { modelPalettePage } from './model-palette'
import { useEffect, useRef, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { useQuery } from '@tanstack/react-query'
import { ArrowUp } from 'lucide-react'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { useComposerDraft } from './useComposerDraft'
import { useComposerAttachments } from './useComposerAttachments'
import {
  ComposerAttachments,
  composerSketchDisabledReason,
} from './ComposerAttachments'
import { ComposerAddButton, ComposerReferences } from './ComposerReferences'
import {
  DraftComposerAttemptStore,
  draftComposerAttemptKey,
  draftAttemptMatches,
  findReferenceTrigger,
  removeReferenceTrigger,
  submittedReferenceSelection,
  useComposerReferences,
  type DraftComposerAttempt,
  type ReferenceTrigger,
} from './useComposerReferences'
import { RunModelPicker } from './RunModelPicker'
import { useRunModel } from './useRunModel'
import type { BotDraftReceipt } from '../core/bot-draft'
import './draft-bot.css'

export function DraftBot({
  draftId,
  visible = true,
  parentId,
  userId,
  onCreated,
  onPending,
}: {
  draftId: string
  visible?: boolean
  parentId: string | null
  userId: string
  onPending?: (
    value: {
      id: string
      botId?: string
      text: string
      userId: string
      workspaceId: string
    } | null,
  ) => void
  onCreated: (
    id: string,
    options?: { focusComposer: boolean },
  ) => void | Promise<void>
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const [text, setText, clearSubmitted, draftSync] = useComposerDraft(
    `${userId}:${workspaceId}:new:${draftId}`,
    userId,
    visible,
  )
  const [attempt, setAttempt] = useState<DraftComposerAttempt | null>(null)
  const [attemptReady, setAttemptReady] = useState(false)
  const [referenceTrigger, setReferenceTrigger] =
    useState<ReferenceTrigger | null>(null)
  const [referencePicker] = useState(() => Popover.createHandle())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  const pending = useRef(false)
  const opened = useRef(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const path = `bot-drafts/${encodeURIComponent(draftId)}`
  const attemptKey = draftComposerAttemptKey(userId, workspaceId, draftId)
  const receipt = useQuery({
    queryKey: ['bot-draft', workspaceId, userId, draftId],
    queryFn: () => request<BotDraftReceipt | null>(path),
    retry: false,
  })
  useEffect(() => {
    mounted.current = true
    textarea.current?.focus()
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    const load = () => {
      try {
        setAttempt(
          new DraftComposerAttemptStore(localStorage, attemptKey).read(),
        )
        setAttemptReady(true)
      } catch {
        setAttemptReady(false)
        setError(
          'The first send could not be recovered on this device. Restore browser storage and check again.',
        )
      }
    }
    load()
    const changed = (event: StorageEvent) => {
      if (event.key === attemptKey || event.key === null) load()
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [attemptKey])
  async function finishDraft(
    saved: BotDraftReceipt,
    captured: DraftComposerAttempt | null,
  ) {
    const matching =
      captured && draftAttemptMatches(captured, saved) ? captured : null
    runModel.carryToConversation(
      saved.botId,
      saved.runModel ?? matching?.input.runModel,
    )
    const textCleared =
      captured && !matching
        ? true
        : clearSubmitted(matching?.rawText ?? saved.text)
    const filesCleared =
      captured && !matching ? true : attachments.clearSubmitted(saved.fileIds)
    const referencesCleared = await references.clearSubmitted(
      submittedReferenceSelection(
        matching?.referenceSelection ?? [],
        saved.references ?? [],
      ),
    )
    if (!textCleared || !filesCleared || !referencesCleared)
      throw new Error(
        'The send is confirmed, but its draft could not be cleared safely. Check again.',
      )
    if (matching) {
      if (!navigator.locks)
        throw new Error(
          'Use an up-to-date browser to recover this send safely.',
        )
      await navigator.locks.request(attemptKey, () =>
        new DraftComposerAttemptStore(localStorage, attemptKey).clear(matching),
      )
    }
    if (mounted.current) {
      opened.current = true
      await onCreated(saved.botId, {
        focusComposer:
          pending.current && document.activeElement === textarea.current,
      })
    }
  }
  useEffect(() => {
    if (!receipt.data?.started || !attemptReady || opened.current) return
    const saved = receipt.data
    opened.current = true
    setBusy(true)
    void Promise.resolve()
      .then(() => finishDraft(saved, attempt))
      .catch((error) => {
        if (mounted.current) {
          opened.current = false
          setError(
            error instanceof Error
              ? error.message
              : 'Could not open this conversation.',
          )
        }
      })
      .finally(() => {
        if (mounted.current) setBusy(false)
      })
  }, [receipt.data, attemptReady, clearSubmitted, onCreated])
  const frozen = receipt.data ?? attempt?.input
  useEffect(() => {
    onPending?.(
      frozen && workspaceId
        ? {
            id: draftId,
            botId: receipt.data?.botId,
            text: frozen.text || 'New conversation',
            userId,
            workspaceId,
          }
        : null,
    )
    return () => onPending?.(null)
  }, [
    receipt.data?.botId,
    frozen?.text,
    !!frozen,
    draftId,
    userId,
    workspaceId,
    onPending,
  ])
  const runModel = useRunModel({
    userId,
    resourcePath: path,
    readOnly: !!frozen || busy,
  })
  const paletteModel = useRef({ runModel, visible, frozen, busy })
  paletteModel.current = { runModel, visible, frozen, busy }
  usePaletteScope({
    id: path,
    name: 'New conversation',
    primary: true,
    available: visible,
    items: [
      {
        id: `${path}:model`,
        label: 'Change model…',
        kind: 'setting',
        icon: 'model',
        detail: runModel.choice?.label,
        keywords: ['reasoning', 'effort', 'provider'],
        disabledReason:
          frozen || busy
            ? 'Finish the pending send first'
            : !runModel.catalogReady
              ? 'Model choices are not ready yet'
              : undefined,
        run: () =>
          modelPalettePage('New conversation', runModel, (selection) => {
            const current = paletteModel.current
            if (
              !current.visible ||
              current.frozen ||
              current.busy ||
              !current.runModel.select(selection)
            )
              throw new Error(
                'This model choice could not be saved. Reopen the picker and try again.',
              )
          }),
      },
    ],
  })
  const attachments = useComposerAttachments({
    visible,
    botId: draftId,
    userId,
    resourcePath: path,
    readOnly: !!frozen || busy,
  })
  const references = useComposerReferences({
    visible,
    userId,
    resourcePath: path,
    readOnly: !!frozen || busy,
  })
  const referencedFiles = references.items.filter(
    (item) => item.kind === 'file',
  ).length
  const referenceLimitExceeded = attachments.items.length + referencedFiles > 5
  const sketchDisabledReason = composerSketchDisabledReason({
    locked:
      !!frozen || busy || !attemptReady || receipt.isPending || receipt.isError,
    fileCount: attachments.items.length + referencedFiles,
    model: runModel,
  })
  async function send() {
    if (
      pending.current ||
      receipt.isPending ||
      receipt.isError ||
      !attemptReady ||
      (!frozen &&
        (attachments.busy ||
          !runModel.valid ||
          !references.valid ||
          referenceLimitExceeded ||
          attachments.readyIds.length !== attachments.items.length))
    )
      return
    const input = frozen
      ? {
          text: frozen.text,
          parentId: frozen.parentId,
          fileIds: frozen.fileIds,
          runModel: frozen.runModel,
          references: frozen.references ?? [],
        }
      : {
          text: text.trim(),
          parentId,
          fileIds: attachments.readyIds,
          runModel: runModel.selection,
          references: references.inputs,
        }
    if (
      !input.text &&
      !input.fileIds.length &&
      !input.references.some((item) => item.kind === 'file')
    )
      return
    const submittedDraft = frozen ? frozen.text : text
    pending.current = true
    setBusy(true)
    setError('')
    let captured = attempt
    try {
      if (!navigator.locks)
        throw new Error('Use an up-to-date browser to send safely.')
      captured = await navigator.locks.request(attemptKey, () =>
        new DraftComposerAttemptStore(localStorage, attemptKey).create(
          input,
          submittedDraft,
          frozen ? [] : references.snapshot,
        ),
      )
      if (mounted.current) setAttempt(captured)
      const result = await request<BotDraftReceipt>(
        path,
        receipt.data ? input : captured.input,
      )
      opened.current = true
      await finishDraft(result, captured)
    } catch (caught) {
      if (mounted.current) {
        opened.current = false
        setError(
          caught instanceof Error
            ? caught.message
            : 'Your message could not be confirmed.',
        )
        // The server may have saved the bot before the response was lost.
        // Recover the original receipt before allowing a different request.
        const current = await receipt.refetch()
        if (
          captured &&
          !current.error &&
          !current.data &&
          caught instanceof ApiError &&
          caught.status >= 400 &&
          caught.status < 500 &&
          caught.status !== 408
        ) {
          const rejectedAttempt = captured
          await navigator.locks.request(attemptKey, () => {
            const store = new DraftComposerAttemptStore(
              localStorage,
              attemptKey,
            )
            store.clear(rejectedAttempt)
          })
          setAttempt(null)
        }
      }
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <section
      data-command-scope={path}
      className={`draft-bot${frozen ? ' draft-bot-sending' : ''}`}
      aria-label="New conversation"
    >
      <div className="draft-bot-content">
        {frozen ? (
          <PendingMessage
            text={frozen.text}
            fileCount={frozen.fileIds.length}
            uncertain={!!error}
          />
        ) : (
          <h1>What would you like to do?</h1>
        )}
        <form
          className="composer"
          onDrop={attachments.onDrop}
          onDragOver={attachments.onDragOver}
          onPaste={attachments.onPaste}
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          {frozen && (
            <div className="composer-frozen-references">
              {!!frozen.fileIds.length && (
                <span>
                  {frozen.fileIds.length}{' '}
                  {frozen.fileIds.length === 1 ? 'attachment' : 'attachments'}{' '}
                  included
                </span>
              )}
              {!!frozen.references?.length && (
                <span>
                  {frozen.references.length}{' '}
                  {frozen.references.length === 1 ? 'reference' : 'references'}{' '}
                  included
                </span>
              )}
            </div>
          )}
          <ComposerAttachments
            attachments={attachments}
            disabled={!!frozen || busy}
            hidden={!!frozen}
            sketchDisabledReason={sketchDisabledReason}
            renderPicker={(choose, chooseSketch) => (
              <ComposerReferences
                picker={referencePicker}
                references={references}
                userId={userId}
                disabled={!!frozen || busy}
                uploadedFileIds={attachments.items.map((item) => item.id)}
                onUpload={choose}
                onSketch={chooseSketch}
                sketchDisabledReason={sketchDisabledReason}
                mention={referenceTrigger}
                composerInput={textarea}
                onCloseMention={() => {
                  if (referenceTrigger)
                    requestAnimationFrame(() => textarea.current?.focus())
                  setReferenceTrigger(null)
                }}
                onSelected={(trigger) => {
                  const removed = trigger
                    ? removeReferenceTrigger(
                        textarea.current?.value ?? text,
                        trigger,
                      )
                    : { text: textarea.current?.value ?? text, caret: null }
                  if (trigger) setText(removed.text)
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
          <DraftSyncNotice sync={draftSync} />
          <DraftSyncNotice sync={references.sync} kind="references" />
          <DraftSyncNotice sync={attachments.sync} kind="attachments" />
          <textarea
            ref={textarea}
            aria-label="First message"
            placeholder={
              references.hasReferences && !referencedFiles && !text.trim()
                ? 'What would you like to do with these?'
                : 'Describe a task or ask a question…'
            }
            maxLength={12000}
            value={frozen ? '' : text}
            readOnly={!!frozen || busy}
            onChange={(event) => {
              setText(event.target.value)
              if (
                !frozen &&
                !busy &&
                !(event.nativeEvent as InputEvent).isComposing
              )
                setReferenceTrigger(
                  findReferenceTrigger(
                    event.target.value,
                    event.target.selectionStart,
                    event.target.selectionEnd,
                  ),
                )
            }}
            rows={3}
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
            <ComposerAddButton
              handle={referencePicker}
              disabled={!!frozen || busy}
            />
            <RunModelPicker
              model={runModel}
              selection={
                frozen ? (frozen.runModel ?? null) : runModel.selection
              }
              disabled={!!frozen || busy}
              frozen={!!frozen}
            />
            {busy && <span role="status">Starting your conversation…</span>}
            <button
              className="send"
              type="submit"
              aria-label={frozen ? 'Retry first message' : 'Send first message'}
              disabled={
                busy ||
                receipt.isPending ||
                receipt.isError ||
                !attemptReady ||
                (!frozen &&
                  (attachments.busy ||
                    !runModel.valid ||
                    !references.valid ||
                    referenceLimitExceeded ||
                    attachments.readyIds.length !==
                      attachments.items.length)) ||
                (!(frozen?.text ?? text).trim() &&
                  !(frozen?.fileIds.length ?? attachments.readyIds.length) &&
                  !(frozen
                    ? frozen.references?.some((item) => item.kind === 'file')
                    : referencedFiles))
              }
            >
              <ArrowUp size={20} />
            </button>
          </div>
        </form>
        {(error || receipt.error) && (
          <p role="alert" className="error">
            {error || receipt.error?.message}
          </p>
        )}
        {(receipt.isError || !attemptReady) && (
          <button
            className="quiet-button"
            onClick={() => {
              try {
                setAttempt(
                  new DraftComposerAttemptStore(
                    localStorage,
                    attemptKey,
                  ).read(),
                )
                setAttemptReady(true)
                setError('')
              } catch {
                setAttemptReady(false)
                setError(
                  'The first send could not be recovered on this device. Restore browser storage and check again.',
                )
              }
              void receipt.refetch()
            }}
          >
            Check draft
          </button>
        )}
      </div>
    </section>
  )
}
