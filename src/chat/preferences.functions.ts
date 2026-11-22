import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { requireChatUser } from './access.server'
import { accountPreferencesInputSchema } from './core/account-preferences'
import {
  readAccountPreferences,
  updateAccountPreferences,
} from './server/account-preferences'

export const loadChatPreferences = createServerFn({ method: 'POST' }).handler(
  async () => {
    const user = await requireChatUser(getRequest())
    return readAccountPreferences(user.userId)
  },
)
export const saveChatPreferences = createServerFn({ method: 'POST' })
  .validator((input: unknown) => accountPreferencesInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireChatUser(getRequest())
    return updateAccountPreferences(user.userId, data)
  })
