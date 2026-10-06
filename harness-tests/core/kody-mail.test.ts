import { describe, expect, it, vi } from 'vitest'
import {
  KODY_MAIL_DETAIL_CODE,
  KODY_MAIL_INBOXES_CODE,
  KODY_MAIL_MESSAGES_CODE,
  projectKodyMailDetail,
  projectKodyMailInboxes,
  projectKodyMailMessages,
} from '../../src/chat/server/kody-mail'

function moduleMain(code: string, kody: object) {
  const program = code
    .replace("import { kody } from 'kody:runtime'", '')
    .replace('export default async function main', 'async function main')
  return new Function('kody', `${program}\nreturn main`)(kody) as (
    params: Record<string, unknown>,
  ) => Promise<unknown>
}

const message = {
  id: 'message-1',
  direction: 'inbound',
  inbox_id: 'inbox-1',
  thread_id: null,
  from_address: 'sender@example.com',
  envelope_from: 'bounce@example.com',
  to_addresses: ['person@inbox.kody.codes'],
  subject: 'Project update',
  processing_status: 'stored',
  classification: 'accepted',
  delivery_status: null,
  received_at: '2026-09-28T12:00:00Z',
  sent_at: null,
  created_at: '2026-09-28T12:00:00Z',
  cc_addresses: [],
  reply_to_addresses: [],
  text_body: 'The report is ready.',
  html_body: '<script>untrusted()</script><p>The report is ready.</p>',
  headers: { authorization: 'private' },
  attachments: [
    {
      id: 'attachment-1',
      filename: 'report.pdf',
      content_type: 'application/pdf',
      size: 250,
      storage_key: 'private-bucket-key',
    },
  ],
}

describe('Kody mail reads', () => {
  it('shows the account inbox address and marks a capped inbox list', async () => {
    const emailInboxList = vi.fn(async () => ({
      inboxes: [
        {
          id: 'inbox-1',
          name: 'default',
          description: 'Personal Kody inbox',
          enabled: true,
          addresses: [{ address: 'person@inbox.kody.codes', enabled: true }],
        },
      ],
    }))
    const value = await moduleMain(KODY_MAIL_INBOXES_CODE, {
      emailInboxList,
    })({})
    expect(emailInboxList).toHaveBeenCalledWith({})
    expect(
      projectKodyMailInboxes({ structuredContent: { result: value } }),
    ).toEqual({
      items: [
        {
          id: 'inbox-1',
          name: 'default',
          description: 'Personal Kody inbox',
          enabled: true,
          addresses: [{ address: 'person@inbox.kody.codes', enabled: true }],
        },
      ],
      limited: false,
    })
  })

  it('lists recent mail and searches only when a query is supplied', async () => {
    const emailMessageList = vi.fn(async () => ({ messages: [message] }))
    const emailMessageSearch = vi.fn(async () => ({ messages: [message] }))
    const main = moduleMain(KODY_MAIL_MESSAGES_CODE, {
      emailMessageList,
      emailMessageSearch,
    })
    const listed = await main({ inboxId: 'inbox-1', query: '' })
    expect(emailMessageList).toHaveBeenCalledWith({
      inbox_id: 'inbox-1',
      limit: 50,
    })
    expect(
      projectKodyMailMessages({ structuredContent: { result: listed } }),
    ).toMatchObject({
      items: [{ id: 'message-1', subject: 'Project update' }],
      limitReached: false,
    })
    await main({ inboxId: 'inbox-1', query: 'project' })
    expect(emailMessageSearch).toHaveBeenCalledWith({
      inbox_id: 'inbox-1',
      query: 'project',
      limit: 50,
    })
    expect(JSON.stringify(listed)).not.toContain(message.html_body)
  })

  it('reads exact message text and attachment metadata without HTML or storage keys', async () => {
    const emailMessageGet = vi.fn(async () => message)
    const value = await moduleMain(KODY_MAIL_DETAIL_CODE, {
      emailMessageGet,
    })({ id: 'message-1' })
    expect(emailMessageGet).toHaveBeenCalledWith({ message_id: 'message-1' })
    const detail = projectKodyMailDetail(
      { structuredContent: { result: value } },
      'message-1',
    )
    expect(detail).toMatchObject({
      id: 'message-1',
      textBody: 'The report is ready.',
      hasHtmlBody: true,
      attachments: [{ filename: 'report.pdf', size: 250 }],
    })
    expect(JSON.stringify(detail)).not.toContain('private-bucket-key')
    expect(JSON.stringify(detail)).not.toContain('<script>')
    expect(() =>
      projectKodyMailDetail(
        { structuredContent: { result: value } },
        'another-message',
      ),
    ).toThrow('unsupported message')
  })
})
