import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/conversations/$id/$operation',
  z.object({ id: z.string(), operation: z.string() }),
  {
    POST: async ({ request, params }) => {
      const { handleConversationRetry } =
        await import('~/chat/server/conversation-retry-http.server')
      const { handleConversationCopy } =
        await import('~/chat/server/conversation-copy-http.server')
      const { handleWorkflowRun } =
        await import('~/chat/server/workflow-run-http.server')
      const { handleWorkflow } =
        await import('~/chat/server/workflow-http.server')
      const { handleConversationExecution } =
        await import('~/chat/server/conversation-execution-http.server')
      const { handleConversationSend } =
        await import('~/chat/server/conversation-http.server')
      const { handleConversationThreads } =
        await import('~/chat/server/conversation-threads-http.server')
      return params.operation === 'retries'
        ? handleConversationRetry(request, params.id, 'create')
        : params.operation === 'copies'
          ? handleConversationCopy(request, params.id, 'conversation')
          : params.operation === 'workflow-runs'
            ? handleWorkflowRun(request, params.id)
            : params.operation === 'workflows'
              ? handleWorkflow(request, params.id)
              : params.operation === 'execution'
                ? handleConversationExecution(request, params.id)
                : ['thread', 'threads'].includes(params.operation)
                  ? handleConversationThreads(
                      request,
                      params.id,
                      params.operation,
                    )
                  : handleConversationSend(request, params.id, params.operation)
    },
    DELETE: async ({ request, params }) => {
      const { handleConversationThreads } =
        await import('~/chat/server/conversation-threads-http.server')
      return handleConversationThreads(request, params.id, params.operation)
    },
    GET: async ({ request, params }) => {
      const { handleConversationCopy } =
        await import('~/chat/server/conversation-copy-http.server')
      const { handleWorkflowRun } =
        await import('~/chat/server/workflow-run-http.server')
      const { handleWorkflow } =
        await import('~/chat/server/workflow-http.server')
      const { handleConversationExecution } =
        await import('~/chat/server/conversation-execution-http.server')
      const { handleConversationRead } =
        await import('~/chat/server/conversation-http.server')
      const { handleConversationThreads } =
        await import('~/chat/server/conversation-threads-http.server')
      return params.operation === 'copy-source'
        ? handleConversationCopy(request, params.id, 'conversation', true)
        : params.operation === 'workflow-runs'
          ? handleWorkflowRun(request, params.id)
          : params.operation === 'workflows'
            ? handleWorkflow(request, params.id)
            : params.operation === 'execution'
              ? handleConversationExecution(request, params.id)
              : ['thread', 'threads'].includes(params.operation)
                ? handleConversationThreads(
                    request,
                    params.id,
                    params.operation,
                  )
                : handleConversationRead(request, params.id, params.operation)
    },
  },
)
