import { useEffect, useRef, useState } from 'react'
import './VisitorChat.css'
import { createRoot } from 'react-dom/client'
import {
  chatPollMs,
  chatStateSchema,
  mergeChatState,
  type VisitorChatState,
} from '~/utils/visitor-chat/contract'
class ChatGoneError extends Error {}

async function requestChat(body?: unknown, before?: number) {
  const response = await fetch(
    `/_a/visitor-chat${before ? `?before=${before}` : ''}`,
    {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    },
  )
  if (response.status === 401 || response.status === 404)
    throw new ChatGoneError()
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? 'Too many requests. Try again shortly.'
        : 'Could not connect. Please try again.',
    )
  return response.status === 204
    ? undefined
    : chatStateSchema.parse(await response.json())
}
function VisitorChat({ onExit }: { onExit: () => void }) {
  const [chat, setChat] = useState(
    (): VisitorChatState | undefined => undefined,
  )
  const [minimized, setMinimized] = useState(() => {
    try {
      return localStorage.getItem('tanstack.visitor-chat.minimized') === '1'
    } catch {
      return false
    }
  })
  const [stopped, setStopped] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (stopped) onExit()
  }, [stopped, onExit])
  const pending: { current: { id: string; body: string } | undefined } =
    useRef(undefined)
  const tail: { current: HTMLDivElement | null } = useRef(null)
  const deliveredThrough = chat?.messages.at(-1)?.sequence ?? 0
  const hasChat = Boolean(chat)
  const readThrough =
    !minimized && document.visibilityState === 'visible' ? deliveredThrough : 0
  useEffect(() => {
    if (stopped) return
    let cancelled = false
    let pendingRequest = false
    const poll = async () => {
      if (pendingRequest) return
      pendingRequest = true
      try {
        const next = await requestChat()
        if (!cancelled && next?.muted) {
          setStopped(true)
          setChat(undefined)
          return
        }
        if (!cancelled && next) {
          setChat((previous) => mergeChatState(previous, next))
          setError('')
        }
      } catch (error) {
        if (!cancelled && error instanceof ChatGoneError) {
          setStopped(true)
          setChat(undefined)
          return
        }
        if (!cancelled)
          setError(
            error instanceof Error ? error.message : 'Could not connect.',
          )
      } finally {
        pendingRequest = false
      }
    }
    void poll()
    const interval = setInterval(poll, chatPollMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [stopped])
  useEffect(() => {
    if (!hasChat || stopped) return
    void requestChat({
      action: 'read',
      delivered: deliveredThrough,
      through: readThrough,
    }).catch(() => {})
    if (!minimized) tail.current?.scrollIntoView({ block: 'nearest' })
  }, [hasChat, deliveredThrough, readThrough, minimized, stopped])
  useEffect(() => {
    try {
      localStorage.setItem(
        'tanstack.visitor-chat.minimized',
        minimized ? '1' : '0',
      )
    } catch {}
  }, [minimized])
  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    const message =
      pending.current?.body === body
        ? pending.current
        : { id: crypto.randomUUID(), body }
    pending.current = message
    setSending(true)
    setError('')
    try {
      const next = await requestChat({ action: 'send', message })
      if (next) setChat((previous) => mergeChatState(previous, next))
      setDraft('')
      pending.current = undefined
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not send. Try again.',
      )
    } finally {
      setSending(false)
    }
  }
  const stop = async () => {
    try {
      await requestChat({ action: 'stop' })
      setStopped(true)
    } catch {
      setError('Could not stop chat. Please try again.')
    }
  }
  if (stopped || !chat) return null
  const agent = [...chat.messages]
    .reverse()
    .find((message) => message.senderRole === 'admin')
  if (!agent) return null
  const unread = chat.messages.filter(
    (message) =>
      message.senderRole === 'admin' && message.sequence > chat.readThrough,
  ).length
  return (
    <aside
      data-analytics-private
      className="fixed bottom-4 right-4 z-[80] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-300 bg-white text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
      aria-label={`Chat with ${agent.senderName}`}
    >
      <header className="flex items-center gap-2 border-b border-gray-500/20 p-3">
        {agent.senderImage ? (
          <img src={agent.senderImage} alt="" className="size-8 rounded-full" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15">
            {agent.senderName.slice(0, 1)}
          </span>
        )}
        <button
          type="button"
          className="min-w-0 flex-1 text-left text-sm font-semibold"
          onClick={() => setMinimized((value) => !value)}
          aria-expanded={!minimized}
        >
          {agent.senderName}
          <span className="block text-[10px] font-normal text-gray-500">
            TanStack
            {minimized && unread > 0 && (
              <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                {unread} new
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          aria-label={minimized ? 'Open chat' : 'Minimize chat'}
          onClick={() => setMinimized((value) => !value)}
          className="px-2"
        >
          {minimized ? '+' : '−'}
        </button>
      </header>
      {!minimized && (
        <>
          <div
            className="max-h-[50dvh] min-h-32 space-y-3 overflow-y-auto p-3"
            role="log"
            aria-label="Chat messages"
            aria-live="polite"
          >
            {chat.hasOlder && (
              <button
                type="button"
                className="text-xs underline"
                onClick={async () => {
                  try {
                    const older = await requestChat(
                      undefined,
                      chat.messages[0]?.sequence,
                    )
                    if (older)
                      setChat((previous) =>
                        mergeChatState(previous, older, true),
                      )
                  } catch {
                    setError('Could not load earlier messages.')
                  }
                }}
              >
                Earlier messages
              </button>
            )}
            {chat.messages.map((message) => (
              <div
                key={message.id}
                className={message.senderRole === 'visitor' ? 'ml-8' : 'mr-8'}
              >
                <div className="mb-1 flex items-center gap-1 text-[10px] text-gray-500">
                  {message.senderImage && message.senderRole === 'admin' && (
                    <img
                      src={message.senderImage}
                      alt=""
                      className="size-4 rounded-full"
                    />
                  )}
                  {message.senderRole === 'visitor'
                    ? 'You'
                    : message.senderName}
                  <time
                    dateTime={message.createdAt.toISOString()}
                    className="ml-1"
                    title={message.createdAt.toLocaleString()}
                  >
                    {message.createdAt.toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <p
                  className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${message.senderRole === 'visitor' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
                >
                  {message.body}
                </p>
              </div>
            ))}
            <div ref={tail} />
          </div>
          {error && (
            <p role="status" className="px-3 pb-2 text-xs text-amber-600">
              {error}
            </p>
          )}
          {chat.closed || chat.muted ? (
            <p className="border-t border-gray-500/20 p-3 text-xs text-gray-500">
              This chat is closed.
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
                aria-label="Reply to TanStack"
                placeholder="Write a reply..."
                value={draft}
                maxLength={4000}
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
                disabled={sending}
                rows={2}
                className="w-full resize-none rounded border border-gray-500/25 bg-transparent p-2 text-sm"
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={stop}
                  className="text-[10px] text-gray-500 underline"
                >
                  Stop chat
                </button>
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </aside>
  )
}
export function mountVisitorChat() {
  if (document.getElementById('tanstack-visitor-chat')) return
  const element = document.createElement('div')
  element.id = 'tanstack-visitor-chat'
  document.body.append(element)
  const root = createRoot(element)
  root.render(
    <VisitorChat
      onExit={() =>
        queueMicrotask(() => {
          root.unmount()
          element.remove()
        })
      }
    />,
  )
}
