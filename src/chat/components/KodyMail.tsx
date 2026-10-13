import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import {
  kodyMailDetailSchema,
  kodyMailInboxesSchema,
  kodyMailMessagesSchema,
  type KodyMailMessage,
} from '../core/kody-mail'
import { useWorkspaceApi } from './WorkspaceApi'
import { Button } from './ui/Button'
import { IconButton } from './IconButton'
import './kody-mail.css'

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function statusLabel(item: KodyMailMessage) {
  if (item.classification === 'quarantined') return 'Quarantined'
  if (item.processingStatus === 'failed') return 'Failed'
  if (item.deliveryStatus && item.deliveryStatus !== 'delivered')
    return item.deliveryStatus
  return item.direction === 'outbound' ? 'Sent' : undefined
}

export function KodyMail({
  userId,
  accountScope,
  visible,
}: {
  userId: string
  accountScope: string
  visible: boolean
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const [inboxId, setInboxId] = useState('')
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const key = ['kody-mail', workspaceId, userId, accountScope]
  const inboxes = useQuery({
    queryKey: [...key, 'inboxes'],
    queryFn: async ({ signal }) =>
      kodyMailInboxesSchema.parse(
        await request('kody/mail/inboxes', undefined, 'GET', { signal }),
      ),
    enabled: visible,
    staleTime: 0,
    refetchInterval: visible ? 60000 : false,
    retry: false,
  })
  const messages = useQuery({
    queryKey: [...key, 'messages', inboxId, query],
    queryFn: async ({ signal }) =>
      kodyMailMessagesSchema.parse(
        await request(
          `kody/mail/messages?${new URLSearchParams({
            ...(inboxId ? { inboxId } : {}),
            ...(query ? { query } : {}),
          })}`,
          undefined,
          'GET',
          { signal },
        ),
      ),
    enabled: visible && !selectedId,
    staleTime: 0,
    refetchInterval: visible && !selectedId ? 60000 : false,
    retry: false,
  })
  const detail = useQuery({
    queryKey: [...key, 'message', selectedId],
    queryFn: async ({ signal }) =>
      kodyMailDetailSchema.parse(
        await request(
          `kody/mail/messages/${encodeURIComponent(selectedId!)}`,
          undefined,
          'GET',
          { signal },
        ),
      ),
    enabled: visible && !!selectedId,
    staleTime: 0,
    retry: false,
  })
  useEffect(() => setSelectedId(null), [inboxId, query])

  function search(event: FormEvent) {
    event.preventDefault()
    const next = draft.trim()
    if (next.length > 200) return
    if (next === query) void messages.refetch()
    else setQuery(next)
  }

  const selectedInbox = inboxes.data?.items.find((item) => item.id === inboxId)
  return (
    <section className="kody-mail" aria-label="Kody mail">
      {selectedId ? (
        <>
          <div className="kody-mail-toolbar">
            <IconButton
              label="Back to messages"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeft size={16} aria-hidden />
            </IconButton>
          </div>
          {detail.isPending && <p role="status">Loading message…</p>}
          {detail.isError && <p role="alert">{detail.error.message}</p>}
          {detail.data && (
            <article className="kody-mail-detail">
              <h2>{detail.data.subject || '(No subject)'}</h2>
              <dl>
                <dt>From</dt>
                <dd>{detail.data.from || 'Unknown sender'}</dd>
                <dt>To</dt>
                <dd>{detail.data.to.join(', ') || 'No recipient listed'}</dd>
                {detail.data.cc.length > 0 && (
                  <>
                    <dt>Cc</dt>
                    <dd>{detail.data.cc.join(', ')}</dd>
                  </>
                )}
                <dt>Date</dt>
                <dd>{dateLabel(detail.data.occurredAt)}</dd>
              </dl>
              {statusLabel(detail.data) && (
                <p className="kody-mail-status">{statusLabel(detail.data)}</p>
              )}
              {detail.data.textBody ? (
                <p className="kody-mail-body">{detail.data.textBody}</p>
              ) : (
                <p>
                  {detail.data.hasHtmlBody
                    ? 'This message has an HTML body, which TanChat does not display yet.'
                    : 'No message body is available.'}
                </p>
              )}
              {detail.data.bodyTruncated && (
                <p>Only the first 100,000 characters are shown.</p>
              )}
              {detail.data.attachments.length > 0 && (
                <div className="kody-mail-attachments">
                  <h3>Attachments</h3>
                  <ul>
                    {detail.data.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        {attachment.filename || 'Unnamed attachment'}
                        {attachment.size !== null
                          ? ` · ${attachment.size.toLocaleString()} bytes`
                          : ''}
                      </li>
                    ))}
                  </ul>
                  {detail.data.attachmentsLimited && (
                    <p>Additional attachments are not shown.</p>
                  )}
                </div>
              )}
            </article>
          )}
        </>
      ) : (
        <>
          <div className="kody-mail-toolbar kody-mail-list-toolbar">
            {inboxes.data && inboxes.data.items.length > 1 ? (
              <select
                aria-label="Kody inbox"
                value={inboxId}
                onChange={(event) => setInboxId(event.target.value)}
              >
                <option value="">All mail</option>
                {inboxes.data.items.map((inbox) => (
                  <option key={inbox.id} value={inbox.id}>
                    {inbox.addresses.find((address) => address.enabled)
                      ?.address || inbox.name}
                  </option>
                ))}
              </select>
            ) : null}
            <IconButton
              label="Refresh Kody mail"
              onClick={() => {
                void inboxes.refetch()
                void messages.refetch()
              }}
            >
              <RotateCcw size={16} aria-hidden />
            </IconButton>
          </div>
          {inboxes.isPending && <p role="status">Loading inboxes…</p>}
          {inboxes.isError && <p role="alert">{inboxes.error.message}</p>}
          {inboxes.data && (
            <p className="kody-mail-addresses">
              {(selectedInbox ? [selectedInbox] : inboxes.data.items)
                .flatMap((inbox) => inbox.addresses)
                .filter((address) => address.enabled)
                .map((address) => address.address)
                .join(', ') || 'No active inbox address'}
            </p>
          )}
          {inboxes.data?.limited && (
            <p>Only the first 100 inboxes are shown.</p>
          )}
          <form className="kody-mail-search" onSubmit={search}>
            <input
              aria-label="Search Kody mail"
              placeholder="Search subject or sender"
              maxLength={200}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" size="sm">
              Search
            </Button>
          </form>
          {messages.isPending && <p role="status">Loading messages…</p>}
          {messages.isError && <p role="alert">{messages.error.message}</p>}
          {messages.data && (
            <>
              <div className="kody-mail-list">
                {messages.data.items.map((item) => (
                  <button
                    type="button"
                    className="kody-mail-row"
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="kody-mail-row-top">
                      <strong>{item.subject || '(No subject)'}</strong>
                      <time>{dateLabel(item.occurredAt)}</time>
                    </span>
                    <span>
                      {item.from || item.to.join(', ') || 'Unknown sender'}
                    </span>
                    {statusLabel(item) && <small>{statusLabel(item)}</small>}
                  </button>
                ))}
              </div>
              {messages.data.items.length === 0 && (
                <p>{query ? 'No matching messages.' : 'No messages yet.'}</p>
              )}
              {messages.data.limitReached && (
                <p>Showing 50 messages. Search to narrow the list.</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
