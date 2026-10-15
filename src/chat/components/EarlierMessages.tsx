import { LoadingState } from './ui/LoadingState'
import { useWorkspaceApi } from './WorkspaceApi'
import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ToolResultPart } from '@tanstack/ai'
import type { ArchivedTurn } from '../core/transcript'
import { ConversationTurn, groupConversation } from './ConversationTurn'
import { CodeBlock } from './MessageMarkdown'
import { ScheduleReview } from './ScheduleReview'
import { KodyMemoryCreateReview } from './KodyMemoryCreateReview'
import { WorkspaceReview } from './WorkspaceReview'
import { messageAnchorId } from '../core/message-navigation'
import { PortalContainer } from './PortalContainer'
import {
  createMessageFocusIntent,
  type MessageFocusIntent,
} from './message-focus'
import {
  conversationQueryKey,
  type ConversationDestination,
} from '../core/conversation-destination'

type Page = {
  turn: ArchivedTurn | null
  nextBefore: number | null
  indexing?: { remainingTurns: number }
}
export function EarlierMessages({
  botId,
  destination,
  name,
  visible = true,
  targetMessageId,
  focusIntent = null,
  getMessageLink,
  onCloseTarget,
  onFork,
  forkDisabled,
  onRetry,
  retryDisabledReason,
  renderMessageThreads,
}: {
  botId: string
  destination?: ConversationDestination
  name: string
  visible?: boolean
  targetMessageId?: string
  focusIntent?: MessageFocusIntent | null
  getMessageLink?: (messageId: string) => string
  onCloseTarget?: () => void
  onFork?: (messageId: string) => void
  forkDisabled?: boolean
  onRetry?: (messageId: string) => void
  retryDisabledReason?: string
  renderMessageThreads?: ComponentProps<
    typeof ConversationTurn
  >['renderMessageThreads']
}) {
  const [browsing, setBrowsing] = useState(false)
  const [automaticTarget, setAutomaticTarget] = useState<string>()
  const [manualFocus, setManualFocus] = useState<MessageFocusIntent>()
  const trigger = useRef<HTMLButtonElement>(null)
  const restoreRequested = useRef(false)
  const currentVisibility = useRef(visible)
  currentVisibility.current = visible
  const open =
    visible &&
    (browsing || (!!targetMessageId && automaticTarget === targetMessageId))
  useEffect(() => {
    if (visible && targetMessageId && focusIntent?.active()) {
      setBrowsing(false)
      setAutomaticTarget(targetMessageId)
    }
  }, [targetMessageId, focusIntent, visible])
  useEffect(() => {
    if (!visible) {
      manualFocus?.cancel()
      setBrowsing(false)
      setAutomaticTarget(undefined)
    }
  }, [visible, manualFocus])
  useEffect(() => () => manualFocus?.cancel(), [manualFocus])
  return (
    <>
      <button
        ref={trigger}
        className="secondary"
        onClick={() => {
          restoreRequested.current = false
          setManualFocus(createMessageFocusIntent())
          setBrowsing(true)
        }}
      >
        {targetMessageId && !open
          ? 'View selected earlier message'
          : 'Earlier messages'}
      </button>
      {open && (
        <HistoryDialog
          key={targetMessageId ?? 'history'}
          botId={botId}
          destination={destination}
          name={name}
          restoreFocus={() => {
            if (
              restoreRequested.current &&
              currentVisibility.current &&
              document.hasFocus() &&
              document.visibilityState === 'visible' &&
              trigger.current?.isConnected
            )
              trigger.current.focus({ preventScroll: true })
            restoreRequested.current = false
          }}
          targetMessageId={targetMessageId}
          focusIntent={browsing ? manualFocus : (focusIntent ?? undefined)}
          getMessageLink={getMessageLink}
          onFork={onFork}
          forkDisabled={forkDisabled}
          onRetry={onRetry}
          retryDisabledReason={retryDisabledReason}
          renderMessageThreads={renderMessageThreads}
          close={() => {
            restoreRequested.current = true
            setBrowsing(false)
            setAutomaticTarget(undefined)
            if (targetMessageId) onCloseTarget?.()
          }}
        />
      )}
    </>
  )
}
function HistoryDialog({
  botId,
  destination,
  name,
  close,
  targetMessageId,
  focusIntent,
  getMessageLink,
  onFork,
  forkDisabled,
  onRetry,
  retryDisabledReason,
  renderMessageThreads,
  restoreFocus,
}: {
  botId: string
  destination?: ConversationDestination
  name: string
  restoreFocus: () => void
  close(): void
  targetMessageId?: string
  focusIntent?: MessageFocusIntent
  getMessageLink?: (messageId: string) => string
  onFork?: (messageId: string) => void
  forkDisabled?: boolean
  onRetry?: (messageId: string) => void
  retryDisabledReason?: string
  renderMessageThreads?: ComponentProps<
    typeof ConversationTurn
  >['renderMessageThreads']
}) {
  const { request: api, workspaceId } = useWorkspaceApi()
  const ref = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const messageScope = `${destination?.sessionKey ?? botId}:archive:${headingId}`
  useLayoutEffect(() => {
    const dialog = ref.current
    focusIntent?.run(() => {
      if (dialog && !dialog.open) dialog.showModal()
    })
  }, [focusIntent])
  useLayoutEffect(() => {
    const dialog = ref.current
    return () => {
      const hadFocus = dialog?.contains(document.activeElement)
      dialog?.close()
      if (hadFocus) restoreFocus()
    }
  }, [])
  const [cursors, setCursors] = useState<Array<number | undefined>>([undefined])
  const before = cursors.at(-1)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const page = useQuery({
    queryKey: [
      ...(destination
        ? conversationQueryKey(destination, 'archive')
        : ['archived-turn', workspaceId, botId]),
      targetMessageId,
      before,
    ],
    queryFn: () =>
      api<Page>(
        `${destination?.apiPath ?? `bots/${encodeURIComponent(botId)}`}/archive${before === undefined ? (targetMessageId ? '?message=' + encodeURIComponent(targetMessageId) : '') : '?before=' + before}`,
      ),
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.status !== 'error' && query.state.data?.indexing
        ? 500
        : false,
    refetchIntervalInBackground: false,
  })
  const turn = page.data?.turn
  useEffect(() => {
    if (!targetMessageId || !turn || before !== undefined) return
    const frame = requestAnimationFrame(() => {
      const message = ref.current?.querySelector<HTMLElement>(
        `#${CSS.escape(messageAnchorId(targetMessageId, messageScope))}`,
      )
      if (message && focusIntent?.active()) {
        message.scrollIntoView({ block: 'center' })
        focusIntent.focus(message)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [targetMessageId, turn?.id, before, focusIntent])
  const results = new Map<string, ToolResultPart>(
    turn?.messages.flatMap((m) =>
      m.parts.flatMap((p) =>
        p.type === 'tool-result' ? [[p.toolCallId, p] as const] : [],
      ),
    ) ?? [],
  )
  return (
    <PortalContainer value={ref}>
      <dialog
        ref={ref}
        className="dialog wide"
        aria-labelledby={headingId}
        onCancel={close}
      >
        <div className="dialog-heading">
          <h2 id={headingId}>Earlier messages</h2>
          <button
            className="icon-button"
            aria-label="Close earlier messages"
            onClick={close}
          >
            ×
          </button>
        </div>
        <div className="archive-page">
          {(page.isPending || (!page.error && page.data?.indexing)) && (
            <LoadingState>
              {targetMessageId
                ? 'Finding this message…'
                : 'Loading earlier messages…'}
            </LoadingState>
          )}
          {page.error && (
            <p role="alert">
              {page.error.message}{' '}
              <button onClick={() => void page.refetch()}>Retry</button>
            </p>
          )}
          {turn &&
            groupConversation(turn.messages).map((group) => (
              <ConversationTurn
                currentConversation={destination}
                key={group.id}
                turn={group}
                name={name}
                outcome={turn.outcome}
                receipts={turn.receipts}
                inherited={turn.inherited}
                running={false}
                waiting={false}
                results={results}
                expanded={expanded}
                setExpanded={(id, value) =>
                  setExpanded((old) => ({ ...old, [id]: value }))
                }
                getMessageLink={getMessageLink}
                targetMessageId={targetMessageId}
                onFork={
                  onFork
                    ? (messageId) => {
                        close()
                        onFork(messageId)
                      }
                    : undefined
                }
                forkDisabled={forkDisabled}
                onRetry={
                  onRetry
                    ? (messageId) => {
                        close()
                        onRetry(messageId)
                      }
                    : undefined
                }
                retryDisabledReason={retryDisabledReason}
                messageScope={messageScope}
                renderMessageThreads={
                  renderMessageThreads
                    ? (id, options) =>
                        renderMessageThreads(id, {
                          ...options,
                          beforeOpen: close,
                        })
                    : undefined
                }
              />
            ))}
          {turn?.approvals.map((approval) => (
            <details key={approval.id}>
              <summary>
                {approval.title} · {approval.status}
              </summary>
              {approval.workspace ? (
                <WorkspaceReview approval={approval} />
              ) : approval.schedule ? (
                <ScheduleReview approval={approval} />
              ) : approval.kodyMemoryCreate ? (
                <KodyMemoryCreateReview approval={approval} />
              ) : (
                <CodeBlock code={approval.code} lang="typescript" />
              )}
              {approval.result && (
                <CodeBlock code={approval.result} lang="json" />
              )}
            </details>
          ))}
          {page.data && !turn && !page.data.indexing && !page.error && (
            <p role="status">
              {targetMessageId
                ? 'This message was not found in earlier messages.'
                : 'No earlier messages.'}
            </p>
          )}
        </div>
        <div className="dialog-actions">
          <button
            className="secondary"
            disabled={
              cursors.length === 1 || page.isFetching || !!page.data?.indexing
            }
            onClick={() => setCursors((old) => old.slice(0, -1))}
          >
            Newer
          </button>
          <button
            className="secondary"
            disabled={
              page.data?.nextBefore == null ||
              page.isFetching ||
              !!page.data?.indexing
            }
            onClick={() => {
              if (page.data?.nextBefore != null)
                setCursors((old) => [...old, page.data!.nextBefore!])
            }}
          >
            Older
          </button>
        </div>
      </dialog>
    </PortalContainer>
  )
}
