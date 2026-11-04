import { chatHttpRoutes } from '~/chat/server/http/routes'
import { recoverChatWorkspaceSync } from '~/chat/server/scheduled.server'
import { runWithDatabaseContext, runWithDatabaseRequest } from '~/db/client'
import {
  runWithHostRuntimeContext,
  runWithHostRuntimeEnv,
} from '~/server/runtime/host.server'

export {
  StreamObject,
  WorkspaceSync,
  Conversation,
  TanChatWorkflow,
} from '~/chat/server/entries'

export default {
  fetch(request: Request, env: unknown, context: unknown) {
    return runWithHostRuntimeEnv(env, () =>
      runWithHostRuntimeContext(context, () =>
        runWithDatabaseRequest(async () => {
          for (const route of chatHttpRoutes) {
            const match = route.match(request)
            if (!match) continue
            if (!match.handler)
              return new Response('Method not allowed', {
                status: 405,
                headers: { Allow: match.allow },
              })
            return match.handler()
          }
          return new Response('Not found', { status: 404 })
        }),
      ),
    )
  },
  scheduled(
    _controller: unknown,
    env: unknown,
    context: { waitUntil(promise: Promise<unknown>): void },
  ) {
    context.waitUntil(
      runWithHostRuntimeEnv(env, () =>
        runWithHostRuntimeContext(context, () =>
          runWithDatabaseContext(() => recoverChatWorkspaceSync()),
        ),
      ),
    )
  },
}
