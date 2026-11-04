import { starterHttpRoutes } from '~/application-starter/api/http/routes'
import { runWithDatabaseRequest } from '~/db/client'
import {
  runWithHostRuntimeContext,
  runWithHostRuntimeEnv,
} from '~/server/runtime/host.server'

export default {
  fetch(request: Request, env: unknown, context: unknown) {
    return runWithHostRuntimeEnv(env, () =>
      runWithHostRuntimeContext(context, () =>
        runWithDatabaseRequest(async () => {
          for (const route of starterHttpRoutes) {
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
}
