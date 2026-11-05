import { z } from 'zod'

// URLPattern is native in workerd, including local development and preview.
declare const URLPattern: typeof import('@cloudflare/workers-types').URLPattern

type HttpContext<TParams> = { request: Request; params: TParams }
type HttpHandler<TParams> = (
  context: HttpContext<TParams>,
) => Response | Promise<Response>

export function defineHttpRoute<TParams extends Record<string, string>>(
  path: string,
  paramsSchema: z.ZodType<TParams>,
  handlers: Record<string, HttpHandler<TParams>>,
) {
  const pattern = new URLPattern({
    pathname: path
      .split('/')
      .map((segment) =>
        segment === '$'
          ? ':_splat*'
          : segment.startsWith('$')
            ? `:${segment.slice(1)}`
            : segment,
      )
      .join('/'),
  })
  return {
    path,
    match(request: Request) {
      const url = new URL(request.url)
      const match = pattern.exec({
        pathname: url.pathname.replace(/\/+$/, '') || '/',
      })
      if (!match) return
      const params: Record<string, string> = {}
      for (const [key, value] of Object.entries(match.pathname.groups)) {
        params[key] = decodeURIComponent(value ?? '')
      }
      const method = request.method === 'HEAD' ? 'GET' : request.method
      const handler = handlers[method]
      const context = { request, params: paramsSchema.parse(params) }
      return {
        handler: handler ? () => handler(context) : undefined,
        context,
        allow: Object.keys(handlers).join(', '),
      }
    },
  }
}
