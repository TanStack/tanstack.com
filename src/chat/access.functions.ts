import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getAuthGuards } from '~/auth/index.server'
import { z } from 'zod'
import {
  readChatAccess,
  createChatInvite,
  redeemChatInvite,
  readChatWaitlist,
  joinChatWaitlist,
} from './access.server'
export const getChatAccess = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getAuthGuards().getCurrentUser(getRequest())
    return user ? readChatAccess(user) : null
  },
)
export const issueChatInvite = createServerFn({ method: 'POST' }).handler(
  async () => createChatInvite(await getAuthGuards().requireAuth(getRequest())),
)
export const acceptChatInvite = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({ token: z.string().min(64).max(100) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) =>
    redeemChatInvite(
      await getAuthGuards().requireAuth(getRequest()),
      data.token,
    ),
  )

export const getChatWaitlist = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getAuthGuards().getCurrentUser(getRequest())
    return user ? readChatWaitlist(user) : false
  },
)
export const requestChatAccess = createServerFn({ method: 'POST' }).handler(
  async () => joinChatWaitlist(await getAuthGuards().requireAuth(getRequest())),
)
