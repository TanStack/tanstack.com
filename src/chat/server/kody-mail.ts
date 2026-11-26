import { z } from 'zod'
import {
  kodyMailDetailSchema,
  kodyMailIdSchema,
  kodyMailInboxesSchema,
  kodyMailMessagesSchema,
  kodyMailQuerySchema,
} from '../core/kody-mail'
import { KodyConnectionError, kodyCall, type KodyEnvironment } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'

export class KodyMailError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message)
    this.name = 'KodyMailError'
  }
}

export const KODY_MAIL_INBOXES_CODE = `import { kody } from 'kody:runtime'
export default async function main() {
  const result = await kody.emailInboxList({})
  return {
    items: result.inboxes.slice(0, 100).map(inbox => ({
      id: inbox.id,
      name: inbox.name,
      description: inbox.description,
      enabled: inbox.enabled,
      addresses: inbox.addresses.map(address => ({
        address: address.address,
        enabled: address.enabled,
      })),
    })),
    limited: result.inboxes.length > 100,
  }
}`

const messageFields = `const project = message => ({
  id: message.id,
  direction: message.direction,
  inboxId: message.inbox_id,
  from: message.from_address || message.envelope_from,
  to: message.to_addresses,
  subject: message.subject,
  processingStatus: message.processing_status,
  classification: message.classification,
  deliveryStatus: message.delivery_status,
  occurredAt: message.received_at || message.sent_at || message.created_at,
})`

export const KODY_MAIL_MESSAGES_CODE = `import { kody } from 'kody:runtime'
${messageFields}
export default async function main(params) {
  const args = {
    limit: 50,
    ...(params.inboxId ? { inbox_id: params.inboxId } : {}),
  }
  const result = params.query
    ? await kody.emailMessageSearch({ ...args, query: params.query })
    : await kody.emailMessageList(args)
  return {
    items: result.messages.map(project),
    limitReached: result.messages.length === 50,
  }
}`

export const KODY_MAIL_DETAIL_CODE = `import { kody } from 'kody:runtime'
${messageFields}
export default async function main(params) {
  const message = await kody.emailMessageGet({ message_id: params.id })
  if (!message) return null
  const textBody = message.text_body
  return {
    ...project(message),
    cc: message.cc_addresses,
    replyTo: message.reply_to_addresses,
    textBody: textBody ? textBody.slice(0, 100000) : null,
    hasHtmlBody: !!message.html_body,
    bodyTruncated: !!textBody && textBody.length > 100000,
    attachments: message.attachments.slice(0, 100).map(attachment => ({
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.content_type,
      size: attachment.size,
    })),
    attachmentsLimited: message.attachments.length > 100,
  }
}`

function unwrap(raw: unknown) {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .safeParse(raw)
  if (!envelope.success || envelope.data.isError)
    throw new KodyMailError('Kody mail could not be read.')
  return envelope.data.structuredContent.result
}

export function projectKodyMailInboxes(raw: unknown) {
  const parsed = kodyMailInboxesSchema.safeParse(unwrap(raw))
  if (!parsed.success)
    throw new KodyMailError('Kody returned unsupported inbox data.')
  return parsed.data
}

export function projectKodyMailMessages(raw: unknown) {
  const parsed = kodyMailMessagesSchema.safeParse(unwrap(raw))
  if (!parsed.success)
    throw new KodyMailError('Kody returned unsupported message data.')
  return parsed.data
}

export function projectKodyMailDetail(raw: unknown, id: string) {
  const value = unwrap(raw)
  if (value === null) throw new KodyMailError('Message was not found.', 404)
  const parsed = kodyMailDetailSchema.safeParse(value)
  if (!parsed.success || parsed.data.id !== id)
    throw new KodyMailError('Kody returned an unsupported message.')
  return parsed.data
}

async function read(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  code: string,
  params: Record<string, unknown>,
  signal: AbortSignal,
  call: typeof kodyCall,
) {
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled)
    throw new KodyMailError(
      before.reason === 'blocked'
        ? 'Kody is disabled in this workspace.'
        : 'Connect Kody to view mail.',
      409,
    )
  try {
    const response = await call(
      env,
      scope.userId,
      'execute',
      kodyInternalReadArgs({ code, params, responseLimit: 200000 }),
      signal,
    )
    await assertKodyReferenceAccountUnchanged(env, scope, options, before)
    return response
  } catch (error) {
    if (error instanceof KodyConnectionError)
      throw new KodyMailError(error.message, 409)
    if (
      error instanceof Error &&
      error.message === 'Kody connection or access changed. Try again.'
    )
      throw new KodyMailError(error.message, 409)
    if (error instanceof KodyMailError) throw error
    throw new KodyMailError('Kody mail could not be checked right now.')
  }
}

export async function listKodyMailInboxes(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  return projectKodyMailInboxes(
    await read(env, scope, options, KODY_MAIL_INBOXES_CODE, {}, signal, call),
  )
}

export async function listKodyMailMessages(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  input: { inboxId?: string; query?: string },
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const inboxId = input.inboxId
    ? kodyMailIdSchema.parse(input.inboxId)
    : undefined
  const query = kodyMailQuerySchema.parse(input.query ?? '')
  return projectKodyMailMessages(
    await read(
      env,
      scope,
      options,
      KODY_MAIL_MESSAGES_CODE,
      { inboxId, query },
      signal,
      call,
    ),
  )
}

export async function getKodyMailMessage(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  id: string,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const input = kodyMailIdSchema.parse(id)
  return projectKodyMailDetail(
    await read(
      env,
      scope,
      options,
      KODY_MAIL_DETAIL_CODE,
      { id: input },
      signal,
      call,
    ),
    input,
  )
}
