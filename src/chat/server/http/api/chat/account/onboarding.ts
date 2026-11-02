import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/account/onboarding', z.object({}), {
  GET: async ({ request }) => {
    const { handleOnboarding } =
      await import('~/chat/server/onboarding-http.server')
    return handleOnboarding(request)
  },
  POST: async ({ request }) => {
    const { handleOnboarding } =
      await import('~/chat/server/onboarding-http.server')
    return handleOnboarding(request)
  },
})
