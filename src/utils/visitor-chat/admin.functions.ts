import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { setTag } from '@sentry/tanstackstart-react'
import { setResponseHeader } from '@tanstack/react-start/server'
import { chatCookieHeader } from './auth.server'
import { visitorChatHintCookie } from './bootstrap'
import { z } from 'zod'
import { chatMessageInput, chatPageInput } from './contract'
import {
  closeAdminChat,
  createAdminTestChat,
  ChatNotFoundError,
  deleteAdminChat,
  listAdminChats,
  readChat,
  reopenAdminChat,
  requireVisitorChatAdmin,
  sendAdminChat,
  startAdminChat,
} from './store.server'

// Runs before input validation so rejected message bodies stay private too.
const chatPrivacy = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    setTag('visitor-chat', 'true')
    setResponseHeader('Cache-Control', 'no-store')
    return next()
  },
)

export const getVisitorChats = createServerFn({ method: 'GET' })
  .middleware([chatPrivacy])
  .validator(
    z.object({ search: z.string().max(200), includeClosed: z.boolean() }),
  )
  .handler(async ({ data }) => listAdminChats(data.search, data.includeClosed))
export const getVisitorChat = createServerFn({ method: 'GET' })
  .middleware([chatPrivacy])
  .validator(chatPageInput)
  .handler(async ({ data }) => {
    await requireVisitorChatAdmin()
    try {
      return await readChat(data.chatId, data.before)
    } catch (error) {
      if (error instanceof ChatNotFoundError) return null
      throw error
    }
  })
export const startVisitorChat = createServerFn({ method: 'POST' })
  .middleware([chatPrivacy])
  .validator(z.object({ sessionId: z.uuid(), message: chatMessageInput }))
  .handler(async ({ data }) => startAdminChat(data.sessionId, data.message))
export const sendVisitorChat = createServerFn({ method: 'POST' })
  .middleware([chatPrivacy])
  .validator(z.object({ chatId: z.uuid(), message: chatMessageInput }))
  .handler(async ({ data }) => sendAdminChat(data.chatId, data.message))
export const closeVisitorChat = createServerFn({ method: 'POST' })
  .middleware([chatPrivacy])
  .validator(chatPageInput.pick({ chatId: true }))
  .handler(async ({ data }) => closeAdminChat(data.chatId))
export const deleteVisitorChat = createServerFn({ method: 'POST' })
  .middleware([chatPrivacy])
  .validator(chatPageInput.pick({ chatId: true }))
  .handler(async ({ data }) => deleteAdminChat(data.chatId))
export const reopenVisitorChat = createServerFn({ method: 'POST' })
  .middleware([chatPrivacy])
  .validator(chatPageInput.pick({ chatId: true }))
  .handler(async ({ data }) => reopenAdminChat(data.chatId))

export const createVisitorChatTest = createServerFn({ method: 'POST' })
  .middleware([chatPrivacy])
  .handler(async () => {
    const target = await createAdminTestChat()
    setResponseHeader('Set-Cookie', [
      await chatCookieHeader(target.chatId),
      `${visitorChatHintCookie}=1; Path=/; Secure; SameSite=Lax; Max-Age=31536000`,
    ])
    return target
  })
