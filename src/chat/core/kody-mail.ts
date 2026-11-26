import { z } from 'zod'

export const kodyMailIdSchema = z.string().min(1).max(200)
export const kodyMailQuerySchema = z.string().trim().max(200)

export const kodyMailInboxSchema = z.object({
  id: kodyMailIdSchema,
  name: z.string().max(160),
  description: z.string().max(500).nullable(),
  enabled: z.boolean(),
  addresses: z.array(
    z.object({
      address: z.string().max(320),
      enabled: z.boolean(),
    }),
  ),
})
export const kodyMailInboxesSchema = z.object({
  items: z.array(kodyMailInboxSchema).max(100),
  limited: z.boolean(),
})

export const kodyMailMessageSchema = z.object({
  id: kodyMailIdSchema,
  direction: z.enum(['inbound', 'outbound']),
  inboxId: kodyMailIdSchema.nullable(),
  from: z.string().max(320).nullable(),
  to: z.array(z.string().max(320)).max(100),
  subject: z.string().max(1000).nullable(),
  processingStatus: z.enum(['stored', 'sent', 'failed']),
  classification: z.enum(['accepted', 'quarantined']),
  deliveryStatus: z
    .enum([
      'delivered',
      'deferred',
      'bounced',
      'failed',
      'rejected',
      'complained',
    ])
    .nullable(),
  occurredAt: z.string().max(80),
})
export const kodyMailMessagesSchema = z.object({
  items: z.array(kodyMailMessageSchema).max(50),
  limitReached: z.boolean(),
})
export const kodyMailDetailSchema = kodyMailMessageSchema.extend({
  cc: z.array(z.string().max(320)).max(100),
  replyTo: z.array(z.string().max(320)).max(100),
  textBody: z.string().max(100000).nullable(),
  hasHtmlBody: z.boolean(),
  bodyTruncated: z.boolean(),
  attachmentsLimited: z.boolean(),
  attachments: z.array(
    z.object({
      id: kodyMailIdSchema,
      filename: z.string().max(500).nullable(),
      contentType: z.string().max(200).nullable(),
      size: z.number().nonnegative().nullable(),
    }),
  ),
})
export type KodyMailMessage = z.infer<typeof kodyMailMessageSchema>
