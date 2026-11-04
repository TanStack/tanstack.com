import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/account/preferences', z.object({}), {
  GET: async ({ request }) => {
    const { handleAccountPreferences } =
      await import('~/chat/server/account-preferences-http.server')
    return handleAccountPreferences(request)
  },
  POST: async ({ request }) => {
    const { handleAccountPreferences } =
      await import('~/chat/server/account-preferences-http.server')
    return handleAccountPreferences(request)
  },
})
