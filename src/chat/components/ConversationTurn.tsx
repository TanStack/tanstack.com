import type { UIMessage, ToolResultPart, ToolCallPart } from '@tanstack/ai'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Clock3,
  FileCode2,
  GitFork,
  Link2,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import { MessageMarkdown } from './MessageMarkdown'
import { ToolCallDetails } from './ToolCallDetails'
import type { Approval } from '../core/types'
import { CopyButton } from './CopyButton'
import { IconButton } from './IconButton'
import type { ToolReceipt } from '../core/conversation-copy'
import { HistoricalReceipts } from './HistoricalReceipts'
import { MessageAttachments } from './MessageAttachments'
import { MessageReferences } from './MessageReferences'
import { readMessageReferences } from '../core/message-references'
import { readMessageAttachments } from '../core/message-attachments'
import { readFileDeliveries } from '../core/file-deliveries'
import {
  readScheduledRunOrigin,
  readDelegatedRunOrigin,
} from '../core/conversation-runs'
import './scheduled-origin.css'
import { SavedFileDeliveries } from './SavedFileDeliveries'
import {
  finalResponse,
  finalResponseParts,
  formatTurnDuration,
  markdownText,
  messageAnchorId,
  messageText,
  turnDurationMs,
  type TurnOutcome,
} from '../core/message-navigation'

function MessageTimestamp({
  message,
  fallback,
}: {
  message: UIMessage
  fallback?: number
}) {
  const timestamp = message.createdAt ?? fallback
  if (timestamp == null) return null
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return null
  return (
    <time
      className="message-timestamp"
      dateTime={date.toISOString()}
      title={date.toLocaleString()}
    >
      {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </time>
  )
}

export function groupConversation(messages: UIMessage[]) {
  const turns: { id: string; prompt?: UIMessage; responses: UIMessage[] }[] = []
  for (const message of messages) {
    if (message.role === 'user')
      turns.push({ id: message.id, prompt: message, responses: [] })
    else if (message.role === 'assistant') {
      if (!turns.length) turns.push({ id: message.id, responses: [] })
      turns.at(-1)!.responses.push(message)
    }
  }
  return turns
}

export function ConversationTurn({
  turn,
  name,
  showSender = false,
  simple = false,
  timeMarker,
  outcome,
  timing,
  running,
  waiting,
  failed,
  taskStatus,
  failureReason,
  results,
  expanded,
  setExpanded,
  toolStates,
  approvals,
  getMessageLink,
  targetMessageId,
  onFork,
  forkDisabled = false,
  onRetry,
  retryDisabledReason,
  receipts = [],
  inherited,
  messageScope,
  currentConversation,
  renderMessageThreads,
}: {
  turn: ReturnType<typeof groupConversation>[number]
  name: string
  showSender?: boolean
  simple?: boolean
  timeMarker?: number
  outcome?: TurnOutcome
  timing?: Pick<TurnOutcome, 'startedAt' | 'completedAt'>
  running: boolean
  waiting: boolean
  failed?: boolean
  taskStatus?: 'incomplete' | 'interrupted'
  failureReason?: string
  results: Map<string, ToolResultPart>
  expanded: Record<string, boolean>
  setExpanded: (id: string, open: boolean) => void
  toolStates?: Record<string, string>
  approvals?: Approval[]
  getMessageLink?: (messageId: string) => string
  targetMessageId?: string
  onFork?: (messageId: string) => void
  forkDisabled?: boolean
  onRetry?: (messageId: string) => void
  retryDisabledReason?: string
  receipts?: ToolReceipt[]
  inherited?: { partial: boolean }
  messageScope?: string
  currentConversation?: Parameters<
    typeof SavedFileDeliveries
  >[0]['currentConversation']
  renderMessageThreads?: (
    messageId: string,
    options: { canCreate: boolean; beforeOpen?: () => void },
  ) => ReactNode
}) {
  const [now, setNow] = useState(() => Date.now())
  const recordedTiming = timing ?? outcome
  useEffect(() => {
    if (
      !running ||
      recordedTiming?.startedAt === undefined ||
      recordedTiming.completedAt !== undefined
    )
      return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [running, recordedTiming?.startedAt, recordedTiming?.completedAt])
  const duration = turnDurationMs(recordedTiming, running ? now : undefined)
  const tools = turn.responses.flatMap((m) =>
    m.parts.flatMap((p) => (p.type === 'tool-call' ? [p] : [])),
  )
  const textMessages = turn.responses.filter((m) =>
    m.parts.some((p) => p.type === 'text' && p.content.trim()),
  )
  const finalCandidate =
    !running && !waiting && !failed && !inherited?.partial
      ? finalResponse(turn, outcome)
      : undefined
  const final = finalResponseParts(finalCandidate).parts.some(
    (part) => part.type === 'text' && part.content.trim(),
  )
    ? finalCandidate
    : undefined
  const { lastTool, parts: finalParts } = finalResponseParts(final)
  const responseMarkdown = turn.responses
    .map(messageText)
    .filter((text) => text.trim())
    .join('\n\n')
  const responseEnd = turn.responses.at(-1)
  const showResponseActions = !!responseEnd && !running && !waiting
  const interim = textMessages.filter((m) => m !== final)
  if (final && lastTool >= 0) {
    const parts = final.parts.slice(0, lastTool + 1)
    if (parts.some((part) => part.type === 'text' && part.content.trim()))
      interim.push({ ...final, parts })
  }
  const hasActivity = tools.length > 0 || receipts.length > 0
  const stopped = failed || outcome?.status === 'error' || !!taskStatus
  const systemNotice =
    !running && !waiting && (stopped || failureReason)
      ? failureReason ||
        outcome?.reason ||
        ((outcome?.termination ?? taskStatus) === 'interrupted'
          ? 'Response stopped.'
          : 'The response could not be completed. Please try again.')
      : undefined
  const pairedReceipts = new Set(
    tools.flatMap((tool) => {
      const output = results.get(tool.id)?.content ?? tool.output
      try {
        const value = typeof output === 'string' ? JSON.parse(output) : output
        return value &&
          typeof value === 'object' &&
          'approvalId' in value &&
          typeof value.approvalId === 'string'
          ? [value.approvalId]
          : []
      } catch {
        return []
      }
    }),
  )
  const activityKey = `activity:${turn.id}`
  const open = expanded[activityKey] ?? false
  const lastTarget = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!targetMessageId) {
      lastTarget.current = undefined
      return
    }
    if (lastTarget.current === targetMessageId) return
    lastTarget.current = targetMessageId
    if (
      targetMessageId !== final?.id &&
      turn.responses.some(
        (message) =>
          message.id === targetMessageId && !messageText(message).trim(),
      )
    )
      setExpanded(activityKey, true)
  }, [targetMessageId, final?.id, turn.responses, activityKey, setExpanded])
  const messageLink = (id: string) =>
    getMessageLink && (
      <CopyButton
        label="Copy message link"
        icon={<Link2 size={14} aria-hidden />}
        text={() => new URL(getMessageLink(id), window.location.href).href}
      />
    )
  const forkMessage = (id: string, response = false, label = 'Fork') =>
    onFork && (
      <IconButton
        className="message-action"
        label={label === 'Fork' ? 'Fork from this message' : label}
        disabled={forkDisabled || (running && response)}
        tooltip={
          forkDisabled
            ? 'Restore this conversation before forking.'
            : running && response
              ? 'Wait for this response to finish.'
              : label === 'Fork'
                ? 'Fork from this message'
                : label
        }
        onClick={() => onFork(id)}
      >
        <GitFork size={14} aria-hidden />
      </IconButton>
    )
  const retryRequest = (edit: boolean) =>
    onRetry &&
    turn.prompt && (
      <IconButton
        className="message-action"
        label={edit ? 'Edit and retry' : 'Try again'}
        disabled={!!retryDisabledReason || running || waiting}
        tooltip={
          retryDisabledReason ||
          (running || waiting
            ? 'Finish or stop this request before trying again.'
            : 'Review and send a new attempt in a separate branch.')
        }
        onClick={() => onRetry(turn.prompt!.id)}
      >
        {edit ? (
          <Pencil size={14} aria-hidden />
        ) : (
          <RotateCcw size={14} aria-hidden />
        )}
      </IconButton>
    )
  return (
    <>
      {simple && timeMarker !== undefined && (
        <time
          className="assistant-time-marker"
          dateTime={new Date(timeMarker).toISOString()}
        >
          {new Date(timeMarker).toDateString() === new Date().toDateString()
            ? new Date(timeMarker).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })
            : new Date(timeMarker).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
        </time>
      )}
      {turn.prompt && (
        <article
          className="message user"
          id={messageAnchorId(turn.prompt.id, messageScope)}
          tabIndex={-1}
          data-message-target={targetMessageId === turn.prompt.id || undefined}
        >
          <div className="message-content">
            {readScheduledRunOrigin(turn.prompt) && (
              <span className="scheduled-origin">
                <Clock3 size={12} aria-hidden />
                Scheduled
              </span>
            )}
            {readDelegatedRunOrigin(turn.prompt) && (
              <span className="scheduled-origin">
                <GitFork size={12} aria-hidden />
                Delegated task
              </span>
            )}
            <MessageAttachments files={readMessageAttachments(turn.prompt)} />
            <MessageReferences
              references={readMessageReferences(turn.prompt)}
            />
            {turn.prompt.parts.map((p, i) =>
              p.type === 'text' ? (
                <MessageMarkdown key={i}>{p.content}</MessageMarkdown>
              ) : null,
            )}
          </div>
          {(recordedTiming?.startedAt ||
            turn.prompt.createdAt ||
            getMessageLink ||
            onFork ||
            onRetry ||
            renderMessageThreads) && (
            <div className="message-actions">
              <MessageTimestamp
                message={turn.prompt}
                fallback={recordedTiming?.startedAt}
              />
              {messageLink(turn.prompt.id)}
              {retryRequest(true)}
              {forkMessage(turn.prompt.id)}
              {renderMessageThreads?.(turn.prompt.id, {
                canCreate: !!messageText(turn.prompt).trim(),
              })}
            </div>
          )}
        </article>
      )}
      <div className="assistant-message-block">
        {interim.map((m) => (
          <div
            className="activity-update message-content"
            key={m.id}
            id={
              m.id === final?.id
                ? undefined
                : messageAnchorId(m.id, messageScope)
            }
            tabIndex={-1}
            data-message-target={
              (targetMessageId === m.id && m.id !== final?.id) || undefined
            }
          >
            {m.parts.map((p, i) =>
              p.type === 'text' ? (
                <MessageMarkdown key={i}>{p.content}</MessageMarkdown>
              ) : null,
            )}
            {m.id !== responseEnd?.id && (
              <div className="message-actions">
                <MessageTimestamp message={m} />
              </div>
            )}
            {m.id !== final?.id &&
              (m.id !== responseEnd?.id || !showResponseActions) &&
              renderMessageThreads?.(m.id, { canCreate: false })}
          </div>
        ))}
        {hasActivity && !simple && (
          <details
            className="turn-activity"
            open={open}
            onToggle={(event) => {
              if (event.currentTarget.open !== open)
                setExpanded(activityKey, event.currentTarget.open)
            }}
          >
            <summary>
              <span role={running ? 'status' : undefined}>
                {inherited?.partial
                  ? 'Copied history'
                  : running
                    ? 'Thinking…'
                    : waiting
                      ? 'Waiting for you'
                      : (outcome?.termination ?? taskStatus) === 'incomplete'
                        ? 'Incomplete'
                        : (outcome?.termination ?? taskStatus) === 'interrupted'
                          ? 'Interrupted'
                          : failed || outcome?.status === 'error'
                            ? 'Stopped'
                            : 'Activity'}
              </span>
              <ChevronRight
                className="turn-activity-chevron"
                size={14}
                strokeWidth={1.5}
                aria-hidden
              />
              {duration !== undefined && (!running || duration > 30_000) && (
                <span title={running ? 'Elapsed time' : 'Activity duration'}>
                  {formatTurnDuration(duration)}
                </span>
              )}
            </summary>
            <div className="message-content">
              {turn.responses
                .filter((message) => !textMessages.includes(message))
                .map((message) => (
                  <span
                    key={message.id}
                    id={messageAnchorId(message.id, messageScope)}
                    tabIndex={-1}
                  />
                ))}
              {tools.map((tool) => {
                return (
                  <div key={tool.id}>
                    <ToolCallDetails
                      call={
                        toolStates?.[tool.id]
                          ? {
                              ...tool,
                              state: toolStates[
                                tool.id
                              ] as ToolCallPart['state'],
                            }
                          : tool
                      }
                      result={results.get(tool.id)}
                      approvals={approvals}
                      historical={
                        !!inherited ||
                        turn.responses.some(
                          (message) =>
                            message.metadata?.gumInherited &&
                            message.parts.includes(tool),
                        )
                      }
                      receipts={receipts}
                      running={running}
                      open={!!expanded[tool.id]}
                      onOpenChange={(value) => setExpanded(tool.id, value)}
                    />
                  </div>
                )
              })}
              <HistoricalReceipts
                receipts={receipts.filter(
                  (receipt) => !pairedReceipts.has(receipt.id),
                )}
              />
            </div>
          </details>
        )}
        {(!hasActivity || simple) && (running || waiting) && (
          <p className="turn-system-message" role="status">
            {running ? 'Thinking…' : 'Waiting for you'}
          </p>
        )}
        {systemNotice && (
          <p className="turn-system-message" role="status">
            {systemNotice}
          </p>
        )}
        {inherited?.partial && !hasActivity && (
          <p className="message-history-note">
            Copied history through this message.
          </p>
        )}
        <SavedFileDeliveries
          deliveries={turn.responses.flatMap(readFileDeliveries)}
          currentConversation={currentConversation}
        />
        {final &&
          finalParts.some(
            (part) => part.type === 'text' && part.content.trim(),
          ) && (
            <article
              className="message assistant"
              id={messageAnchorId(final.id, messageScope)}
              tabIndex={-1}
              data-message-target={targetMessageId === final.id || undefined}
            >
              {showSender && (
                <div className="message-byline">
                  <strong>{name}</strong>
                </div>
              )}
              <div className="message-content">
                {finalParts.map((p, i) =>
                  p.type === 'text' ? (
                    <MessageMarkdown key={i}>{p.content}</MessageMarkdown>
                  ) : null,
                )}
              </div>
              {final.id !== responseEnd?.id &&
                renderMessageThreads?.(final.id, { canCreate: false })}
            </article>
          )}
        {showResponseActions && (
          <div
            className="message-actions"
            role="group"
            aria-label="Response actions"
          >
            {responseMarkdown.trim() && (
              <>
                <CopyButton
                  label="Copy response"
                  text={() => markdownText(responseMarkdown, true)}
                />
                <CopyButton
                  label="Copy Markdown"
                  icon={<FileCode2 size={14} aria-hidden />}
                  text={responseMarkdown}
                />
              </>
            )}
            {messageLink(responseEnd.id)}
            {forkMessage(responseEnd.id, true, 'Fork from this response')}
            {retryRequest(false)}
            {renderMessageThreads?.(responseEnd.id, {
              canCreate: !!responseMarkdown.trim(),
            })}
            <MessageTimestamp
              message={responseEnd}
              fallback={recordedTiming?.completedAt}
            />
          </div>
        )}
      </div>
    </>
  )
}
