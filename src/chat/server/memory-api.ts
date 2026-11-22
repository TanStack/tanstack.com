import { z } from 'zod'
import { Memories, MemoryError, type MemoryScope } from './memory'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'

/** Scope is supplied by the authenticated workspace route, never by request JSON. */
export async function memoryApi(
  request: Request,
  scope: MemoryScope,
  id?: string,
): Promise<Response> {
  const json = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  try {
    const memories = new Memories(scope)
    const url = new URL(request.url)
    if (id === 'preferences') {
      if (request.method === 'GET') return json(await memories.preferences())
      if (request.method === 'POST')
        return json(
          await memories.setPreferences(await readWorkspaceJson(request)),
        )
      return json({ error: 'Method not allowed.' }, 405)
    }
    if (request.method === 'GET') {
      if (id) return json(await memories.read(id))
      const limit = url.searchParams.get('limit')
      return json(
        await memories.list({
          query: url.searchParams.get('query') ?? '',
          afterId: url.searchParams.get('afterId') ?? undefined,
          ...(limit === null ? {} : { limit: z.coerce.number().parse(limit) }),
        }),
      )
    }
    if (request.method === 'POST' && !id) {
      return json(await memories.command(await readWorkspaceJson(request)))
    }
    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    if (error instanceof MemoryError || error instanceof WorkspaceBodyError)
      return json({ error: error.message }, error.status)
    if (error instanceof z.ZodError)
      return json({ error: 'Check the memory fields and try again.' }, 400)
    throw error
  }
}
