import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  listChatWaitlistAdmin,
  listChatInvitesAdmin,
  grantChatAccessAdmin,
  createChatInviteAdmin,
  expireChatInviteAdmin,
} from './access-admin.server'

const pagination = z.object({ page: z.number().int().min(0).max(100000) })

export const listChatWaitlist = createServerFn({ method: 'GET' })
  .validator(
    pagination.extend({ status: z.enum(['waiting', 'granted', 'all']) }),
  )
  .handler(({ data }) => listChatWaitlistAdmin(data))

export const listChatInvites = createServerFn({ method: 'GET' })
  .validator(
    pagination.extend({
      status: z.enum(['pending', 'redeemed', 'expired', 'all']),
    }),
  )
  .handler(({ data }) => listChatInvitesAdmin(data))

export const grantChatAccess = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: z.uuid() }))
  .handler(({ data }) => grantChatAccessAdmin(data.userId))

export const createAdminChatInvite = createServerFn({ method: 'POST' }).handler(
  () => createChatInviteAdmin(),
)

export const expireChatInvite = createServerFn({ method: 'POST' })
  .validator(z.object({ tokenHash: z.string().regex(/^[a-f0-9]{64}$/) }))
  .handler(({ data }) => expireChatInviteAdmin(data.tokenHash))
