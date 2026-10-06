import { SelectField } from './SelectField'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import type { WorkspaceBot } from '../core/bot-workspace'
import type { BranchBoundary } from '../core/conversation-copy'
import {
  copyBotName,
  copyBotPlacement,
  copyRequestStorageKey,
  parseSavedCopyAttempt,
  type CopyBotRequest,
  type SavedCopyAttempt,
} from '../core/copy-bot'
import './copy-bot-dialog.css'
import { conversationResourcePath } from '../core/conversation-destination'

type BoundaryResult =
  | { ok: true; boundary: BranchBoundary }
  | { ok: false; code: string; error: string; status: number }
type CopyOperation = {
  operationId: string
  status: 'copying' | 'ready' | 'failed'
  botId?: string
  error?: { code: string; message: string }
}
type Props = {
  bot: WorkspaceBot
  bots: WorkspaceBot[]
  userId: string
  messageId?: string
  conversationId?: string
  onClose: () => void
  onCreated: (botId: string) => void | Promise<void>
}

// Retain the frozen request and operation address until the result is handled.
// The server owns progress, and restored operations always recheck the API.
const pendingRequests = new Map<string, SavedCopyAttempt>()
function loadPending(
  key: string,
  messageId: string | undefined,
  source: { conversationId: string; allowLegacy: boolean },
) {
  try {
    return (
      parseSavedCopyAttempt(sessionStorage.getItem(key), messageId, source) ??
      parseSavedCopyAttempt(
        JSON.stringify(pendingRequests.get(key) ?? null),
        messageId,
        source,
      ) ??
      null
    )
  } catch {
    return (
      parseSavedCopyAttempt(
        JSON.stringify(pendingRequests.get(key) ?? null),
        messageId,
        source,
      ) ?? null
    )
  }
}
function savePending(key: string, attempt: SavedCopyAttempt) {
  pendingRequests.set(key, attempt)
  try {
    sessionStorage.setItem(key, JSON.stringify(attempt))
    return true
  } catch {
    return false
  }
}
function clearPending(key: string) {
  pendingRequests.delete(key)
  try {
    sessionStorage.removeItem(key)
  } catch {}
}

export function CopyBotDialog(props: Props) {
  return (
    <CopyBotForm
      key={copyRequestStorageKey(
        props.userId,
        props.bot,
        props.messageId,
        props.conversationId,
      )}
      {...props}
    />
  )
}

function CopyBotForm({
  bot,
  bots,
  userId,
  messageId,
  conversationId,
  onClose,
  onCreated,
}: Props) {
  const { request, workspaceId } = useWorkspaceApi()
  const [sourceConversationId] = useState(
    () => conversationId ?? bot.mainConversationId,
  )
  if (!sourceConversationId)
    throw new Error('Resolve the conversation before copying it.')
  const [sourcePath] = useState(() =>
    conversationResourcePath({
      botId: bot.id,
      conversationId: sourceConversationId,
    }),
  )
  const mainSource = sourceConversationId === bot.mainConversationId
  const sourceMetadata = mainSource ? {} : { sourceConversationId }
  const kind = messageId === undefined ? 'duplicate' : 'fork'
  const storageKey = copyRequestStorageKey(
    userId,
    bot,
    messageId,
    sourceConversationId,
  )
  const [restored] = useState(() =>
    loadPending(storageKey, messageId, {
      conversationId: sourceConversationId,
      allowLegacy: mainSource,
    }),
  )
  const [attempt, setAttempt] = useState<CopyBotRequest | null>(
    restored?.request ?? null,
  )
  const placement = copyBotPlacement(bot, bots)
  const [name, setName] = useState(
    () => attempt?.name ?? copyBotName(bot.name, kind),
  )
  const [location, setLocation] = useState<'sibling' | 'child'>(() =>
    attempt
      ? attempt.parentId === bot.id
        ? 'child'
        : 'sibling'
      : kind === 'fork' && placement.canBeChild
        ? 'child'
        : 'sibling',
  )
  const [operation, setOperation] = useState<CopyOperation | null>(() =>
    restored?.operationId
      ? { operationId: restored.operationId, status: 'copying' }
      : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  const [needsReview, setNeedsReview] = useState(false)
  const [storageUnavailable, setStorageUnavailable] = useState(false)
  const pending = useRef(false)
  const opened = useRef<string | undefined>(undefined)
  const dialog = useRef<HTMLDialogElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const restoreFocus = useRef(true)
  const titleId = useId()
  const explanationId = useId()
  const locationId = useId()
  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    const active = document.activeElement
    opener.current = active instanceof HTMLElement ? active : null
    element.showModal()
    nameInput.current?.focus()
    return () => {
      // Close before React detaches the dialog, while focus can still return.
      // Opening the copied bot leaves focus to the destination instead.
      if (restoreFocus.current) {
        element.close()
        if (opener.current?.isConnected)
          opener.current.focus({ preventScroll: true })
      }
    }
  }, [])
  function dismiss() {
    dialog.current?.close()
    if (opener.current?.isConnected)
      opener.current.focus({ preventScroll: true })
    onClose()
  }
  const boundary = useQuery({
    queryKey: ['copy-boundary', workspaceId, userId, sourcePath, messageId],
    queryFn: () =>
      request<BoundaryResult>(
        `${sourcePath}/copy-boundary${messageId === undefined ? '' : '?message=' + encodeURIComponent(messageId)}`,
      ),
    enabled: !attempt && !operation && !needsReview && bot.deleted_at === null,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.status !== 'error' &&
      query.state.data?.ok === false &&
      query.state.data.code === 'indexing'
        ? 750
        : false,
    refetchIntervalInBackground: false,
  })
  const progress = useQuery({
    queryKey: ['copy-operation', workspaceId, userId, operation?.operationId],
    queryFn: () =>
      request<CopyOperation>(
        `copies/${encodeURIComponent(operation!.operationId)}`,
      ),
    enabled: !!operation && operation.status === 'copying',
    retry: false,
    refetchInterval: (query) =>
      query.state.status !== 'error' &&
      (query.state.data?.status ?? operation?.status) === 'copying'
        ? 1000
        : false,
    refetchIntervalInBackground: false,
  })
  const current = progress.data ?? operation
  async function openCopy(botId: string) {
    setOpening(true)
    setError('')
    restoreFocus.current = false
    try {
      await onCreated(botId)
      clearPending(storageKey)
      onClose()
    } catch (error) {
      restoreFocus.current = true
      setError(
        error instanceof Error
          ? error.message
          : 'The copy is ready, but could not be opened.',
      )
    } finally {
      setOpening(false)
    }
  }
  useEffect(() => {
    if (
      current?.status !== 'ready' ||
      !current.botId ||
      opened.current === current.operationId
    )
      return
    opened.current = current.operationId
    void openCopy(current.botId)
  }, [current?.operationId, current?.status, current?.botId])
  async function submit() {
    if (pending.current || bot.deleted_at !== null) return
    const frozen =
      attempt ??
      (boundary.data?.ok
        ? {
            idempotencyKey: crypto.randomUUID(),
            kind,
            boundary: boundary.data.boundary,
            name: name.trim(),
            parentId:
              location === 'child' && placement.canBeChild
                ? bot.id
                : (placement.siblingParent?.id ?? null),
          }
        : null)
    if (!frozen) return
    pending.current = true
    setSubmitting(true)
    setError('')
    setAttempt(frozen)
    setStorageUnavailable(
      !savePending(storageKey, { ...sourceMetadata, request: frozen }),
    )
    try {
      const result = await request<CopyOperation>(
        `${sourcePath}/copies`,
        frozen,
      )
      if (
        !result.operationId ||
        !['copying', 'ready', 'failed'].includes(result.status) ||
        (result.status === 'ready' && !result.botId)
      )
        throw new Error('The copy response could not be confirmed.')
      setStorageUnavailable(
        !savePending(storageKey, {
          ...sourceMetadata,
          request: frozen,
          operationId: result.operationId,
        }),
      )
      setOperation(result)
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      ) {
        clearPending(storageKey)
        setAttempt(null)
        setNeedsReview(true)
      }
      setError(
        error instanceof Error
          ? error.message
          : 'The copy request could not be confirmed.',
      )
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }
  const indexing =
    boundary.data?.ok === false && boundary.data.code === 'indexing'
  const boundaryError =
    boundary.error?.message ??
    (boundary.data?.ok === false && !indexing ? boundary.data.error : '')
  async function reviewAgain() {
    clearPending(storageKey)
    setAttempt(null)
    setOperation(null)
    setError('')
    setNeedsReview(false)
    await boundary.refetch()
  }
  return (
    <dialog
      ref={dialog}
      className="copy-bot-dialog"
      aria-labelledby={titleId}
      aria-describedby={explanationId}
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
    >
      <div className="copy-bot-heading">
        <h2 id={titleId}>
          {kind === 'fork'
            ? 'Fork from this message'
            : 'Duplicate conversation'}
        </h2>
        <button
          type="button"
          className="copy-bot-close"
          aria-label="Close"
          onClick={dismiss}
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <p id={explanationId}>
        {kind === 'fork'
          ? 'Copies your conversation through this message. Previous work will not run again.'
          : 'Copies your conversation history. Previous work will not run again.'}{' '}
        Saved files stay in the original conversation.
      </p>
      {current ? (
        <>
          {current.status === 'copying' && (
            <>
              {!progress.error && (
                <p role="status">
                  {restored?.operationId && !progress.data
                    ? 'Checking copy…'
                    : 'Copying conversation…'}
                </p>
              )}
              <p>You can close this dialog while the copy finishes.</p>
            </>
          )}
          {current.status === 'ready' && (
            <>
              <p role="status">
                {opening ? 'Opening your copy…' : 'Your copy is ready.'}
              </p>
              {current.botId && !opening && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => void openCopy(current.botId!)}
                >
                  Open conversation
                </button>
              )}
            </>
          )}
          {current.status === 'failed' && (
            <>
              <p role="alert">
                {current.error?.message ??
                  'The conversation could not be copied.'}
              </p>
              <button
                type="button"
                className="secondary"
                onClick={() => void reviewAgain()}
              >
                Review and try again
              </button>
            </>
          )}
          {progress.error && (
            <p role="alert">
              {progress.error.message}{' '}
              <button
                type="button"
                className="secondary"
                onClick={() => void progress.refetch()}
              >
                Retry status
              </button>
            </p>
          )}
        </>
      ) : bot.deleted_at !== null ? (
        <p role="status">Restore this conversation before copying it.</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <fieldset disabled={!!attempt || submitting}>
            <label>
              Name
              <input
                ref={nameInput}
                required
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label htmlFor={locationId}>
              Location
              <SelectField
                id={locationId}
                value={location}
                onValueChange={(value) =>
                  setLocation(value === 'child' ? 'child' : 'sibling')
                }
                items={[
                  {
                    value: 'sibling',
                    label: placement.siblingParent
                      ? `Under ${placement.siblingParent.name}`
                      : 'Top level',
                  },
                  ...(placement.canBeChild
                    ? [
                        {
                          value: 'child',
                          label: <>Under {bot.name}</>,
                        },
                      ]
                    : []),
                ]}
              />
            </label>
          </fieldset>
          {!attempt && (boundary.isPending || indexing) && (
            <p role="status">
              {indexing ? 'Finding this message…' : 'Checking conversation…'}
            </p>
          )}
          {boundaryError && !attempt && <p role="alert">{boundaryError}</p>}
          {attempt && !submitting && (
            <p role="status">
              The previous request has not been confirmed. Checking it again
              will use the same request.
            </p>
          )}
          {storageUnavailable && attempt && (
            <p role="status">
              Keep this page open until the copy is confirmed.
            </p>
          )}
          <div className="copy-bot-actions">
            {needsReview || (!attempt && boundaryError) ? (
              <button
                type="button"
                className="secondary"
                disabled={boundary.isFetching}
                onClick={() => void reviewAgain()}
              >
                Review latest history
              </button>
            ) : (
              <button
                type="submit"
                className="primary"
                disabled={
                  submitting ||
                  !name.trim() ||
                  (!attempt && (!boundary.data?.ok || boundary.isFetching))
                }
              >
                {submitting
                  ? 'Starting copy…'
                  : attempt
                    ? 'Check copy'
                    : kind === 'fork'
                      ? 'Create fork'
                      : 'Duplicate'}
              </button>
            )}
          </div>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {storageUnavailable && current?.status === 'copying' && (
        <p role="status">Keep this page open until your copy is ready.</p>
      )}
    </dialog>
  )
}
