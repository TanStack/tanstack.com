import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/bots/$id/$operation',
  z.object({ id: z.string(), operation: z.string() }),
  {
    POST: async ({ request, params }) => {
      const { handleConversationCopy } =
        await import('~/chat/server/conversation-copy-http.server')
      const { handleConversationRead, handleConversationSend } =
        await import('~/chat/server/conversation-http.server')
      const { handleBotMutation } =
        await import('~/chat/server/bot-mutation-http.server')
      return params.operation === 'copies'
        ? handleConversationCopy(request, params.id, 'bot')
        : ['move', 'delete', 'restore'].includes(params.operation)
          ? handleBotMutation(request, params.id, params.operation)
          : handleConversationSend(request, params.id, params.operation, 'bot')
    },
    PATCH: async ({ request, params }) => {
      const { handleBotMutation } =
        await import('~/chat/server/bot-mutation-http.server')
      return handleBotMutation(request, params.id, params.operation)
    },
    GET: async ({ request, params }) => {
      const { handleConversationCopy } =
        await import('~/chat/server/conversation-copy-http.server')
      const { handleConversationRead, handleConversationSend } =
        await import('~/chat/server/conversation-http.server')
      return params.operation === 'copy-source'
        ? handleConversationCopy(request, params.id, 'bot', true)
        : handleConversationRead(request, params.id, params.operation, 'bot')
    },
  },
)
