import { PixelSpinner } from '~/components/ds/ui/PixelSpinner'
import { conversationRouteQuery } from './conversationRouteQuery'
import { useConversationNavigatorScope } from './ConversationNavigatorScope'
import { LoadingState } from './ui/LoadingState'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Spool, RotateCcw } from 'lucide-react'
import {
  type ThreadSummary,
  type ThreadListItem,
} from '../core/conversation-threads'
import type { ConversationDestination } from '../core/conversation-destination'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { IconButton } from './IconButton'
import {
  composerFocusHandoff,
  type ComposerFocusHandoff,
} from './composer-focus'
import { ThreadTitle } from './ThreadTitle'
import { MessageMarkdown } from './MessageMarkdown'
import './conversation-threads.css'
import {
  threadAccessDenied,
  threadRequestKey,
  ThreadRequestStore,
  threadQueryKey,
} from './conversation-thread-state'

export type ThreadOpenIntent = {
  handoff: ComposerFocusHandoff
  source: HTMLButtonElement
  closeDetails?: boolean
  messageId?: string
}
function openIntent(source: HTMLButtonElement): ThreadOpenIntent {
  return { source, handoff: composerFocusHandoff(source) }
}
export function MessageThreads({
  destination,
  messageId,
  threads,
  canCreate,
  onOpen,
}: {
  destination: ConversationDestination
  messageId: string
  threads: ThreadListItem[]
  canCreate: boolean
  onOpen: (thread: ThreadListItem, intent?: ThreadOpenIntent) => void
}) {
  const api = useWorkspaceApi()
  const queryClient = useQueryClient()
  const key = threadRequestKey(
    destination.userId,
    destination.workspaceId,
    destination.conversationId,
    messageId,
  )
  const [pending, setPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  const working = useRef(false)
  useEffect(() => {
    mounted.current = true
    try {
      setPending(!!new ThreadRequestStore(localStorage, key).read())
    } catch {
      setError('The thread request could not be recovered on this device.')
    }
    return () => {
      mounted.current = false
    }
  }, [key])
  async function create(source: HTMLButtonElement) {
    if (working.current || !canCreate) return
    const intent = openIntent(source)
    working.current = true
    setBusy(true)
    setError('')
    try {
      if (!navigator.locks)
        throw new Error('Use an up-to-date browser to create a thread safely.')
      await navigator.locks.request(key, async () => {
        const store = new ThreadRequestStore(localStorage, key)
        const command = store.create(messageId)
        if (mounted.current) setPending(true)
        try {
          const result = await api.request<ThreadSummary>(
            `${destination.apiPath}/threads`,
            command,
          )
          if (
            result.parentConversationId !== destination.conversationId ||
            result.botId !== destination.botId ||
            result.conversationId === destination.conversationId
          )
            throw new Error('The thread does not match this conversation.')
          store.clear(command)
          await queryClient.invalidateQueries({
            queryKey: threadQueryKey(destination),
          })
          if (mounted.current) {
            setPending(false)
            onOpen(result, intent)
          } else {
            intent.handoff.cancel()
          }
        } catch (cause) {
          if (
            cause instanceof ApiError &&
            cause.status >= 400 &&
            cause.status < 500 &&
            ![408, 429].includes(cause.status)
          ) {
            store.clear(command)
            if (mounted.current) setPending(false)
          }
          throw cause
        }
      })
    } catch (cause) {
      intent.handoff.cancel()
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'The thread could not be opened.',
        )
    } finally {
      working.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <div
      className="message-threads"
      data-has-threads={threads.length > 0 || undefined}
    >
      {threads.map((thread) => (
        <ThreadLink
          key={thread.conversationId}
          thread={thread}
          preview
          onOpen={onOpen}
        />
      ))}
      {canCreate && (!threads.length || pending) && (
        <IconButton
          className="message-action"
          label={pending ? 'Retry opening thread' : 'Start thread'}
          disabled={busy}
          onClick={(event) => void create(event.currentTarget)}
        >
          {pending ? (
            <RotateCcw size={14} aria-hidden />
          ) : (
            <Spool size={14} aria-hidden />
          )}
        </IconButton>
      )}
      {busy && <LoadingState>Opening thread…</LoadingState>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function ThreadLink({
  thread,
  onOpen,
  active,
  preview = false,
}: {
  thread: ThreadListItem
  onOpen: (thread: ThreadListItem, intent?: ThreadOpenIntent) => void
  active?: boolean
  preview?: boolean
}) {
  const scope = useConversationNavigatorScope()
  const queries = useQueryClient()
  const { request, workspaceId } = useWorkspaceApi()
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState('')
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const open = async (source: HTMLButtonElement) => {
    const attempt = ++scope.threadOpenAttempt.current
    setOpening(true)
    setOpenError('')
    const intent = openIntent(source)
    try {
      const bot = scope.family.members.find(
        (item) => item.bot.id === thread.botId,
      )?.bot
      const targetBot =
        bot ??
        (scope.selected.id === thread.botId
          ? scope.selected
          : scope.family.root)
      if (targetBot.id !== thread.botId)
        throw new Error('This conversation is unavailable.')
      await Promise.all([
        queries.fetchQuery(
          conversationRouteQuery({
            queries,
            request,
            workspaceId,
            bot: targetBot,
            conversationId: thread.conversationId,
            userId: scope.userId,
          }),
        ),
        queries.fetchQuery({
          queryKey: [
            'conversation-thread',
            targetBot.workspace_id,
            scope.userId,
            thread.conversationId,
          ],
          queryFn: async () => {
            const value = await request<ThreadSummary>(
              `conversations/${encodeURIComponent(thread.conversationId)}/thread`,
            )
            if (
              value.conversationId !== thread.conversationId ||
              value.botId !== thread.botId ||
              value.parentConversationId !== thread.parentConversationId
            )
              throw new Error(
                'This thread does not match the requested conversation.',
              )
            return value
          },
          staleTime: 30_000,
        }),
      ])
      if (mounted.current && attempt === scope.threadOpenAttempt.current)
        onOpen(thread, intent)
      else intent.handoff.cancel()
    } catch (error) {
      intent.handoff.cancel()
      if (mounted.current)
        setOpenError(
          error instanceof Error ? error.message : 'Could not open thread.',
        )
    } finally {
      if (mounted.current) setOpening(false)
    }
  }
  const status = thread.activity?.status
  const attention =
    status === 'approval' || status === 'setup' || status === 'error'
  const unread =
    !!thread.activity?.messageCount &&
    thread.activity.eventVersion > thread.activity.readVersion
  return (
    <button
      type="button"
      className="thread-link"
      aria-current={active ? 'page' : undefined}
      aria-busy={opening || undefined}
      disabled={opening}
      title={openError || undefined}
      onClick={(event) => void open(event.currentTarget)}
    >
      {opening ? (
        <PixelSpinner className="h-6 w-6 shrink-0" />
      ) : (
        <Spool size={14} aria-hidden />
      )}
      {openError && <span role="alert">Could not open. Try again.</span>}
      {preview ? (
        <>
          <span className="thread-link-label">
            {thread.activity?.messageCount
              ? `Thread (${thread.activity.messageCount})`
              : 'Open thread'}
          </span>
          {!!thread.activity?.messageCount &&
            thread.activity.preview.trim() && (
              <span className="thread-link-preview">
                {thread.activity.preview.trim()}
              </span>
            )}
        </>
      ) : (
        <span>{thread.title}</span>
      )}
      {thread.archivedAt !== null ? (
        <small>Archived</small>
      ) : status === 'running' ? (
        <small>Working</small>
      ) : attention ? (
        <small>Needs attention</small>
      ) : unread ? (
        <small>Unread</small>
      ) : (
        !preview &&
        !!thread.activity?.messageCount && (
          <small>{thread.activity.messageCount} messages</small>
        )
      )}
    </button>
  )
}
export function ThreadPanel({
  parent,
  threadId,
  active,
  readOnly = false,
  onReturn,
  onOpenFull,
  children,
}: {
  parent: ConversationDestination
  threadId: string
  active: boolean
  readOnly?: boolean
  onReturn: (messageId: string) => void
  onOpenFull: (thread: ThreadSummary) => void
  children: (thread: ThreadSummary) => ReactNode
}) {
  const { request } = useWorkspaceApi()
  const query = useQuery({
    queryKey: [
      'conversation-thread',
      parent.workspaceId,
      parent.userId,
      threadId,
    ],
    queryFn: async () => {
      const descriptor = await request<ThreadSummary>(
        `conversations/${encodeURIComponent(threadId)}/thread`,
      )
      if (
        descriptor.conversationId !== threadId ||
        descriptor.parentConversationId !== parent.conversationId ||
        descriptor.botId !== parent.botId ||
        threadId === parent.conversationId
      )
        throw new Error('This thread does not belong to the open conversation.')
      return descriptor
    },
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: active ? 5000 : false,
    refetchIntervalInBackground: false,
  })
  const verified = useRef<ThreadSummary | undefined>(undefined)
  if (threadAccessDenied(query.error)) verified.current = undefined
  else if (query.isFetchedAfterMount && query.data && !query.error)
    verified.current = query.data
  const value = verified.current
  if (query.error && !value)
    return (
      <p role="alert" className="error">
        {query.error.message}{' '}
        <button onClick={() => void query.refetch()}>Retry</button>
      </p>
    )
  if (!value) return <LoadingState inset>Opening thread…</LoadingState>
  return (
    <section
      className="thread-conversation"
      aria-label={`Thread: ${value.title}`}
    >
      {query.error && (
        <p className="error" role="alert">
          Thread details could not be refreshed.{' '}
          <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      )}
      <div className="thread-heading">
        <button
          type="button"
          className="quiet-button"
          onClick={() => onReturn(value.sourceMessageId)}
        >
          Source message
        </button>
        <ThreadTitle
          userId={parent.userId}
          thread={value}
          disabled={readOnly || !!query.error}
        />
        <IconButton
          label="Open thread in full view"
          onClick={() => onOpenFull(value)}
        >
          <ArrowUpRight size={16} aria-hidden />
        </IconButton>
      </div>
      <details className="thread-source">
        <summary>Original message</summary>
        <MessageMarkdown>{value.source.text}</MessageMarkdown>
        {value.source.truncated && <p>Source excerpt</p>}
      </details>
      {children(value)}
    </section>
  )
}
