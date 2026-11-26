import { z } from 'zod'

export const oauthPopupChannelSchema = z.uuid()
export const oauthPopupAttemptSchema = z.object({
  state: z.string().min(1).max(1024),
  channel: oauthPopupChannelSchema,
})
export const oauthPopupMessageSchema = z.object({
  type: z.literal('TANSTACK_AUTH_SUCCESS'),
  channel: oauthPopupChannelSchema,
})
export const oauthPopupChannelName = (channel: string) =>
  `tanstack.oauth.${channel}`
