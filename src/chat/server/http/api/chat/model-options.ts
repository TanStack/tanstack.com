import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/model-options', z.object({}), {
  GET: async ({ request }) => {
    const { handleModelOptions } =
      await import('~/chat/server/model-options-http.server')
    return handleModelOptions(request)
  },
})
