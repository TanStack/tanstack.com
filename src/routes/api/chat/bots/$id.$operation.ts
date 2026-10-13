import {handleConversationCopy} from '~/chat/server/conversation-copy-http.server'
import { createFileRoute } from '@tanstack/react-router'
import { handleConversationRead, handleConversationSend } from '~/chat/server/conversation-http.server'

import { handleBotMutation } from '~/chat/server/bot-mutation-http.server'

export const Route = createFileRoute('/api/chat/bots/$id/$operation')({
  server: {
    handlers: {
      POST: ({ request, params }) => params.operation==='copies' ? handleConversationCopy(request,params.id,'bot') : ['move','delete','restore'].includes(params.operation) ? handleBotMutation(request,params.id,params.operation) : handleConversationSend(request, params.id, params.operation, 'bot'),
      PATCH: ({request,params}) => handleBotMutation(request,params.id,params.operation),
      GET: ({ request, params }) => params.operation==='copy-source' ? handleConversationCopy(request,params.id,'bot',true) : handleConversationRead(request, params.id, params.operation, 'bot'),
    },
  },
})
