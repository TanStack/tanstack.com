import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/account/devices', z.object({}), {
  GET: async ({ request }) => {
    const { handleDeviceAccount } =
      await import('~/chat/server/device-http.server')
    return handleDeviceAccount(request)
  },
  POST: async ({ request }) => {
    const { handleDeviceAccount } =
      await import('~/chat/server/device-http.server')
    return handleDeviceAccount(request)
  },
})
