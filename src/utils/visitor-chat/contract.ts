import { z } from 'zod'

export const chatMessageInput = z.object({
  id: z.uuid(),
  body: z.string().trim().min(1).max(4000),
})
export const chatMessageSchema = z.object({
  id: z.uuid(),
  sequence: z.number().int().positive(),
  senderRole: z.enum(['admin', 'visitor']),
  senderName: z.string(),
  senderImage: z.string().nullable(),
  body: z.string(),
  createdAt: z.coerce.date(),
})
export type VisitorChatMessage = z.infer<typeof chatMessageSchema>
export const chatStateSchema = z.object({
  id: z.uuid(),
  closed: z.boolean(),
  muted: z.boolean(),
  deliveredThrough: z.number().int().nonnegative(),
  readThrough: z.number().int().nonnegative(),
  lastVisitorSeenAt: z.coerce.date().nullable(),
  messages: z.array(chatMessageSchema),
  hasOlder: z.boolean(),
})
export type VisitorChatState = z.infer<typeof chatStateSchema>
export const chatPageInput = z.object({
  chatId: z.uuid(),
  before: z.number().int().positive().optional(),
})
export const visitorChatCookie = '__Host-tanstack_visitor_chat'
export const visitorChatTestCookie = '__Host-tanstack_visitor_chat_test'
export const visitorChatCookieAge = 365 * 24 * 60 * 60
export const chatPollMs = 2000

export function mergeChatState(
  previous: VisitorChatState | undefined,
  next: VisitorChatState,
  older = false,
): VisitorChatState {
  if (!previous || previous.id !== next.id) return next
  const messages = new Map(
    previous.messages.map((message) => [message.id, message]),
  )
  for (const message of next.messages) messages.set(message.id, message)
  return {
    ...next,
    messages: [...messages.values()].sort((a, b) => a.sequence - b.sequence),
    hasOlder: older ? next.hasOlder : previous.hasOlder,
  }
}
