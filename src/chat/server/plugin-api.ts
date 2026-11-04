import type { CredentialEnv } from './credentials'
import { z } from 'zod'
import { Plugins, PluginError, type PluginScope } from './plugins'
import { PluginFormatError } from '../core/plugins'

export async function pluginApi(
  request: Request,
  env: CredentialEnv,
  scope: PluginScope,
  id?: string,
): Promise<Response> {
  const json = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  try {
    const service = new Plugins(env, scope),
      url = new URL(request.url)
    if (request.method === 'GET') {
      if (id)
        return json(
          await service.inspect(
            id,
            url.searchParams.has('version')
              ? z.coerce
                  .number()
                  .int()
                  .positive()
                  .safe()
                  .parse(url.searchParams.get('version'))
              : undefined,
          ),
        )
      const removed = url.searchParams.get('removed') ?? 'false',
        enabled = url.searchParams.get('enabled')
      if (
        !['true', 'false'].includes(removed) ||
        (enabled !== null && !['true', 'false'].includes(enabled))
      )
        throw new PluginError('Choose a valid plugin filter.')
      return json(
        await service.list({
          query: url.searchParams.get('query') ?? '',
          removed: removed === 'true',
          ...(enabled === null ? {} : { enabled: enabled === 'true' }),
          cursor: url.searchParams.get('cursor') ?? undefined,
          ...(url.searchParams.has('limit')
            ? { limit: Number(url.searchParams.get('limit')) }
            : {}),
        }),
      )
    }
    if (request.method === 'POST' && (!id || id === 'preview')) {
      // JSON escaping may expand the parser's 1 MiB decoded file limit up to sixfold.
      const limit = 7 * 1024 * 1024
      if (Number(request.headers.get('content-length')) > limit)
        throw new PluginError('The plugin request is too large.')
      if (!request.body)
        throw new PluginError('Provide a plugin package or command.')
      const reader = request.body.getReader(),
        chunks: Uint8Array[] = []
      let length = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          length += value.byteLength
          if (length > limit) {
            await reader.cancel()
            throw new PluginError('The plugin request is too large.')
          }
          chunks.push(value)
        }
      } finally {
        reader.releaseLock()
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const c of chunks) {
        bytes.set(c, offset)
        offset += c.length
      }
      let input: unknown
      try {
        input = JSON.parse(
          new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
            bytes,
          ),
        )
      } catch {
        throw new PluginError('Provide valid plugin JSON.')
      }
      if (id === 'preview') {
        const value = z.object({ files: z.unknown() }).strict().parse(input)
        return json(await service.preview(value.files))
      }
      return json(await service.command(input))
    }
    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    if (error instanceof PluginError)
      return json({ error: error.message }, error.status)
    if (error instanceof PluginFormatError)
      return json({ error: error.message }, 400)
    if (error instanceof z.ZodError)
      return json({ error: 'Check the plugin fields and try again.' }, 400)
    throw error
  }
}
