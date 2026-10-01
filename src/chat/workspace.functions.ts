import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { requireChatUser } from './access.server'
import {
  archiveConversations,
  createPersonalConversation,
  openPersonalChatWorkspace,
} from './workspace.server'

export const loadChatWorkspace = createServerFn({ method: 'POST' }).handler(
  async () => {
    const user = await requireChatUser(getRequest())
    return openPersonalChatWorkspace(user.userId)
  },
)

export const createChatConversation = createServerFn({
  method: 'POST',
}).handler(async () => {
  const user = await requireChatUser(getRequest())
  return createPersonalConversation(user.userId)
})

const archiveInput = z
  .object({ botIds: z.array(z.string().min(1).max(200)).min(1).max(200) })
  .strict()
export const archiveChatConversations = createServerFn({ method: 'POST' })
  .validator((input: unknown) => archiveInput.parse(input))
  .handler(async ({ data }) => {
    const user = await requireChatUser(getRequest())
    return archiveConversations(user.userId, data.botIds)
  })
