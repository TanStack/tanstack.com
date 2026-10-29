import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './AdminVisitorChats.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  closeVisitorChat,
  deleteVisitorChat,
  getVisitorChat,
  getVisitorChats,
  reopenVisitorChat,
  sendVisitorChat,
  startVisitorChat,
} from '~/utils/visitor-chat/admin.functions'
import {
  chatPollMs,
  chatStateSchema,
  mergeChatState,
  type VisitorChatState,
} from '~/utils/visitor-chat/contract'

type ChatTarget = { sessionId: string; label: string; chatId?: string | null }

export default function AdminVisitorChats({
  target,
  request,
}: {
  target: ChatTarget | null
  request: number
}) {
  const [tabs, setTabs] = useState((): ChatTarget[] => [])
  const [minimized, setMinimized] = useState((): string[] => [])
  const [inboxOpen, setInboxOpen] = useState(false)
  const open = (next: ChatTarget) => {
    const existing = tabs.find(
      (item) =>
        item.sessionId === next.sessionId ||
        (next.chatId && item.chatId === next.chatId),
    )
    setTabs((previous) =>
      existing
        ? previous.map((item) =>
            item.sessionId === existing.sessionId
              ? { ...item, chatId: next.chatId || item.chatId }
              : item,
          )
        : [...previous, next],
    )
    setMinimized((previous) =>
      previous.filter((id) => id !== (existing?.sessionId || next.sessionId)),
    )
  }

  useEffect(() => {
    if (target) open(target)
    else setInboxOpen(true)
  }, [target, request])
  return createPortal(
    <div
      data-analytics-private
      className="visitor-chat-dock"
      role="region"
      aria-label="Visitor messaging"
    >
      {tabs.map((item) => (
        <ChatPanel
          key={item.sessionId}
          target={item}
          minimized={minimized.includes(item.sessionId)}
          onToggle={() =>
            setMinimized((previous) =>
              previous.includes(item.sessionId)
                ? previous.filter((id) => id !== item.sessionId)
                : [...previous, item.sessionId],
            )
          }
          onClose={() =>
            setTabs((previous) =>
              previous.filter((tab) => tab.sessionId !== item.sessionId),
            )
          }
          onOpen={open}
        />
      ))}
      <ChatPanel
        target={null}
        minimized={!inboxOpen}
        onToggle={() => setInboxOpen((value) => !value)}
        onClose={() => setInboxOpen(false)}
        onOpen={open}
      />
    </div>,
    document.body,
  )
}

function ChatPanel({
  target,
  minimized,
  onToggle,
  onClose,
  onOpen,
}: {
  target: ChatTarget | null
  minimized: boolean
  onToggle: () => void
  onClose: () => void
  onOpen: (target: ChatTarget) => void
}) {
  const client = useQueryClient()
  const [selected, setSelected] = useState(target?.chatId || '')
  const [search, setSearch] = useState('')
  const [includeClosed, setIncludeClosed] = useState(false)
  const [chat, setChat] = useState((): VisitorChatState | undefined => {
    const cached = chatStateSchema.safeParse(
      client.getQueryData(['admin', 'visitor-chat', selected]),
    )
    return cached.success ? cached.data : undefined
  })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const pending: { current: { id: string; body: string } | undefined } =
    useRef(undefined)
  const tail: { current: HTMLDivElement | null } = useRef(null)
  const inbox = useQuery({
    queryKey: ['admin', 'visitor-chats', search, includeClosed],
    queryFn: () => getVisitorChats({ data: { search, includeClosed } }),
    enabled: !target && !minimized,
    refetchInterval: chatPollMs,
    retry: false,
  })
  const thread = useQuery({
    queryKey: ['admin', 'visitor-chat', selected],
    queryFn: () => getVisitorChat({ data: { chatId: selected } }),
    enabled: Boolean(selected),
    refetchInterval: chatPollMs,
    retry: false,
  })
  useEffect(() => {
    setChat(undefined)
    setDraft('')
    setError('')
    pending.current = undefined
  }, [selected])
  useEffect(() => {
    const next = thread.data
    if (next) setChat((previous) => mergeChatState(previous, next))
    else if (thread.isSuccess && next === null) {
      setChat(undefined)
      onClose()
      void client.invalidateQueries({ queryKey: ['admin', 'visitor-chats'] })
    }
  }, [thread.data, thread.isSuccess, client])
  const lastSequence = chat?.messages.at(-1)?.sequence
  useEffect(() => {
    tail.current?.scrollIntoView({ block: 'nearest' })
  }, [lastSequence])
  const send = async () => {
    const body = draft.trim()
    if (!body || sending || (!selected && !target)) return
    const message =
      pending.current?.body === body
        ? pending.current
        : { id: crypto.randomUUID(), body }
    pending.current = message
    setSending(true)
    setError('')
    try {
      const next = selected
        ? await sendVisitorChat({ data: { chatId: selected, message } })
        : target
          ? await startVisitorChat({
              data: { sessionId: target.sessionId, message },
            })
          : undefined
      if (next) {
        if (target) onOpen({ ...target, chatId: next.id })
        setSelected(next.id)
        setChat((previous) => mergeChatState(previous, next))
        client.setQueryData(['admin', 'visitor-chat', next.id], next)
      }
      setDraft('')
      pending.current = undefined
      void client.invalidateQueries({ queryKey: ['admin', 'visitor-chats'] })
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not send. Try again.',
      )
    } finally {
      setSending(false)
    }
  }
  const label = selected
    ? target?.label || `Visitor ${selected.slice(0, 8)}`
    : target?.label || 'Select a chat'
  return (
    <aside
      data-analytics-private
      aria-label={target ? label : 'Shared visitor inbox'}
      className={`visitor-chat-panel ${minimized ? 'visitor-chat-minimized' : ''} flex flex-col rounded-t-lg border border-gray-500/25 bg-white text-gray-900 shadow-lg dark:bg-gray-950 dark:text-gray-100}`}
    >
      <header className="flex items-center justify-between border-b border-gray-500/20 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!minimized}
          className="min-w-0 flex-1 truncate text-left text-xs font-semibold"
        >
          {target ? label : 'Chats'}
          {chat?.messages.at(-1)?.senderRole === 'visitor' && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400">
              Reply
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={minimized ? 'Expand chat' : 'Minimize chat'}
          className="px-2 text-sm"
        >
          {minimized ? '▴' : '▾'}
        </button>
        <button
          type="button"
          aria-label={target ? `Dismiss ${label} tab` : 'Minimize chat inbox'}
          onClick={onClose}
          className="rounded border border-gray-500/20 px-2 py-1 text-xs"
        >
          ×
        </button>
      </header>
      <div
        hidden={minimized}
        className="min-h-0 flex-1"
        style={{ display: minimized ? 'none' : 'flex' }}
      >
        {!target && (
          <nav
            aria-label="Shared visitor conversations"
            className="flex min-w-0 flex-1 flex-col"
          >
            <input
              aria-label="Search chats"
              placeholder="Company or visitor..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={200}
              className="m-2 min-w-0 rounded border border-gray-500/25 bg-transparent p-2 text-xs"
            />
            <label className="flex items-center gap-2 px-2 pb-2 text-[11px] text-gray-500">
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={(event) => setIncludeClosed(event.target.checked)}
              />
              Include closed
            </label>
            {inbox.isError && (
              <button
                type="button"
                className="p-2 text-xs text-amber-600"
                onClick={() => inbox.refetch()}
              >
                Could not load chats. Retry
              </button>
            )}
            <div className="min-h-0 flex-1 overflow-auto">
              {inbox.data?.chats.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  disabled={sending}
                  onClick={() => {
                    onOpen({
                      chatId: item.id,
                      sessionId: item.originSessionId,
                      label:
                        item.company?.name ||
                        item.company?.domain ||
                        `Visitor ${item.originSessionId.slice(0, 8)}`,
                    })
                  }}
                  aria-current={selected === item.id ? 'true' : undefined}
                  className={`block w-full border-b border-gray-500/10 p-3 text-left text-xs hover:bg-gray-500/10 ${selected === item.id ? 'bg-emerald-500/10' : ''}`}
                >
                  <span className="block truncate font-medium">
                    {item.company?.name ||
                      item.company?.domain ||
                      `Visitor ${item.originSessionId.slice(0, 8)}`}
                  </span>
                  <span className="mt-1 block text-[10px] text-gray-500">
                    {item.mutedAt
                      ? 'Visitor stopped chat'
                      : item.closedAt
                        ? 'Closed'
                        : item.lastSenderRole === 'visitor'
                          ? 'Needs reply'
                          : item.lastVisitorSeenAt
                            ? 'Open'
                            : 'Waiting for visitor'}{' '}
                    ·{' '}
                    {new Date(item.updatedAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
              ))}
              {inbox.data?.truncated && (
                <p className="p-2 text-[10px] text-gray-500">
                  Showing 200 matches. Narrow the search.
                </p>
              )}
              {inbox.data && !inbox.data.chats.length && (
                <p className="p-3 text-xs text-gray-500">No matching chats.</p>
              )}
            </div>
          </nav>
        )}
        {target && (
          <section
            className="flex min-w-0 flex-1 flex-col"
            aria-label="Conversation"
          >
            <header className="flex justify-end gap-3 border-b border-gray-500/15 px-3 py-2 text-xs">
              {chat && (
                <>
                  <button
                    type="button"
                    disabled={Boolean(chat.muted)}
                    className="text-gray-500 underline disabled:opacity-40"
                    onClick={async () => {
                      try {
                        const next = chat.closed
                          ? await reopenVisitorChat({
                              data: { chatId: chat.id },
                            })
                          : await closeVisitorChat({
                              data: { chatId: chat.id },
                            })
                        setChat((previous) => mergeChatState(previous, next))
                        await thread.refetch()
                        await inbox.refetch()
                      } catch {
                        setError('Could not update chat.')
                      }
                    }}
                  >
                    {chat.closed ? 'Reopen' : 'Close chat'}
                  </button>
                  <button
                    type="button"
                    className="text-red-600 underline"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          'Delete this chat and every message permanently?',
                        )
                      )
                        return
                      try {
                        await deleteVisitorChat({ data: { chatId: chat.id } })
                        onClose()
                        setChat(undefined)
                        await inbox.refetch()
                      } catch {
                        setError('Could not delete chat.')
                      }
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </header>
            <div
              className="min-h-0 flex-1 space-y-4 overflow-auto p-4"
              role="log"
              aria-label="Conversation messages"
              aria-live="polite"
            >
              {chat?.hasOlder && (
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={async () => {
                    try {
                      const older = await getVisitorChat({
                        data: {
                          chatId: chat.id,
                          before: chat.messages[0]?.sequence,
                        },
                      })
                      if (older)
                        setChat((previous) =>
                          mergeChatState(previous, older, true),
                        )
                      else {
                        setChat(undefined)
                        setSelected('')
                      }
                    } catch {
                      setError('Could not load earlier messages.')
                    }
                  }}
                >
                  Earlier messages
                </button>
              )}
              {chat?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[90%] ${message.senderRole === 'admin' ? 'ml-auto' : ''}`}
                >
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-gray-500">
                    {message.senderImage && (
                      <img
                        src={message.senderImage}
                        alt=""
                        className="size-4 rounded-full"
                      />
                    )}
                    {message.senderName} ·{' '}
                    {new Date(message.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                  <p
                    className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${message.senderRole === 'admin' ? 'bg-emerald-500/10' : 'bg-gray-100 dark:bg-gray-800'}`}
                  >
                    {message.body}
                  </p>
                  {message.senderRole === 'admin' && (
                    <span className="mt-1 block text-right text-[10px] text-gray-500">
                      {chat.readThrough >= message.sequence
                        ? 'Seen'
                        : chat.deliveredThrough >= message.sequence
                          ? 'Delivered'
                          : 'Sent'}
                    </span>
                  )}
                </div>
              ))}
              {!selected && target && (
                <p className="text-xs text-gray-500">
                  Your first message opens a chat on this visitor's browser. It
                  may take up to 20 seconds to appear.
                </p>
              )}
              {thread.isError && (
                <button
                  type="button"
                  className="text-xs text-amber-600 underline"
                  onClick={() => thread.refetch()}
                >
                  Could not load messages. Retry
                </button>
              )}
              <div ref={tail} />
            </div>
            {error && (
              <p role="alert" className="px-3 pb-2 text-xs text-amber-600">
                {error}
              </p>
            )}
            {(target || selected) &&
              (chat?.closed || chat?.muted ? (
                <p className="border-t border-gray-500/20 p-3 text-xs text-gray-500">
                  {chat.muted
                    ? 'The visitor stopped this chat.'
                    : 'This chat is closed.'}
                </p>
              ) : (
                <form
                  className="border-t border-gray-500/20 p-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void send()
                  }}
                >
                  <textarea
                    aria-label="Message visitor"
                    rows={3}
                    maxLength={4000}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
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
                    title="Enter to send, Shift+Enter for a new line"
                    disabled={sending || (Boolean(selected) && !chat)}
                    placeholder="Write a message..."
                    className="w-full resize-none rounded border border-gray-500/25 bg-transparent p-2 text-sm"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={
                        !draft.trim() || sending || (Boolean(selected) && !chat)
                      }
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      {sending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </form>
              ))}
          </section>
        )}
      </div>
    </aside>
  )
}
