import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/device-transport', z.object({}), {
  POST: async ({ request }) => {
    const { handleDeviceTransport } =
      await import('~/chat/server/device-http.server')
    return handleDeviceTransport(request)
  },
})
