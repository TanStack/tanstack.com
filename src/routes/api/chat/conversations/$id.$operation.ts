import {handleConversationRetry} from '~/chat/server/conversation-retry-http.server'
import {handleConversationCopy} from '~/chat/server/conversation-copy-http.server'
import {handleWorkflowRun} from '~/chat/server/workflow-run-http.server'
import {handleWorkflow} from '~/chat/server/workflow-http.server'
import {handleConversationExecution} from '~/chat/server/conversation-execution-http.server'
import { createFileRoute } from '@tanstack/react-router'
import { handleConversationRead, handleConversationSend } from '~/chat/server/conversation-http.server'

import {handleConversationThreads} from '~/chat/server/conversation-threads-http.server'

export const Route = createFileRoute('/api/chat/conversations/$id/$operation')({
  server: {
    handlers: {
      POST: ({ request, params }) => params.operation==='retries' ? handleConversationRetry(request,params.id,'create') : params.operation==='copies' ? handleConversationCopy(request,params.id,'conversation') : params.operation==='workflow-runs' ? handleWorkflowRun(request,params.id) : params.operation==='workflows' ? handleWorkflow(request,params.id) : params.operation==='execution' ? handleConversationExecution(request,params.id) : ['thread','threads'].includes(params.operation) ? handleConversationThreads(request,params.id,params.operation) : handleConversationSend(request, params.id, params.operation),
      DELETE: ({request,params}) => handleConversationThreads(request,params.id,params.operation),
      GET: ({ request, params }) => params.operation==='copy-source' ? handleConversationCopy(request,params.id,'conversation',true) : params.operation==='workflow-runs' ? handleWorkflowRun(request,params.id) : params.operation==='workflows' ? handleWorkflow(request,params.id) : params.operation==='execution' ? handleConversationExecution(request,params.id) : ['thread','threads'].includes(params.operation) ? handleConversationThreads(request,params.id,params.operation) : handleConversationRead(request, params.id, params.operation),
    },
  },
})
