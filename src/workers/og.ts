import { handlers as og } from '~/server/og/og-http.server'
import { handlers as readme } from '~/server/og/readme-http.server'
import { runWithHostRuntimeEnv } from '~/server/runtime/host.server'

export default {
  fetch(request: Request, env: unknown) {
    return runWithHostRuntimeEnv(env, () => {
      const match = /^\/api\/(og|readme)\/(.+)\.png$/.exec(
        new URL(request.url).pathname,
      )
      if (!match) return new Response('Not found', { status: 404 })
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD' },
        })
      }
      const handler = match[1] === 'og' ? og.GET : readme.GET
      return handler({
        request,
        params: { _splat: decodeURIComponent(match[2]) },
      })
    })
  },
}
