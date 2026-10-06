import type { KodyEnvironment } from './kody'
import { Skills, SkillError, type SkillScope } from './skills'
import { z } from 'zod'
import { SkillCatalog } from './skill-catalog'

/** Thin HTTP adapter. The service remains the authorization boundary for UI and tools. */
export async function skillApi(
  request: Request,
  env: KodyEnvironment,
  scope: SkillScope,
  id?: string,
): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  try {
    const skills = new Skills(scope),
      url = new URL(request.url)
    if (request.method === 'GET') {
      if (id) {
        const version = url.searchParams.get('version')
        return json(
          await new SkillCatalog(env, scope).inspect(
            id,
            version === null
              ? undefined
              : z.coerce.number().int().positive().safe().parse(version),
          ),
        )
      }
      const archived = url.searchParams.get('archived') ?? 'false'
      if (!['true', 'false'].includes(archived))
        throw new SkillError('Choose an active or archived skill list.')
      const enabled = url.searchParams.get('enabled')
      if (enabled !== null && !['true', 'false'].includes(enabled))
        throw new SkillError('Choose an enabled or disabled skill filter.')
      const limit = url.searchParams.get('limit')
      if (url.searchParams.get('catalog') === 'external')
        return json(
          await new SkillCatalog(env, scope).list({
            source: 'external',
            query: url.searchParams.get('query') ?? '',
            cursor: url.searchParams.get('cursor') ?? undefined,
            ...(limit ? { limit: z.coerce.number().parse(limit) } : {}),
          }),
        )
      return json(
        await skills.list({
          query: url.searchParams.get('query') ?? '',
          archived: archived === 'true',
          ...(enabled === null ? {} : { enabled: enabled === 'true' }),
          cursor: url.searchParams.get('cursor') ?? undefined,
          ...(limit ? { limit: z.coerce.number().parse(limit) } : {}),
        }),
      )
    }
    if (request.method === 'POST' && !id) {
      if (Number(request.headers.get('content-length')) > 200000)
        throw new SkillError('The skill request is too large.', 400)
      if (!request.body) throw new SkillError('Provide a skill command.')
      const reader = request.body.getReader(),
        chunks: Uint8Array[] = []
      let length = 0
      try {
        while (true) {
          const part = await reader.read()
          if (part.done) break
          length += part.value.byteLength
          if (length > 200000) {
            await reader.cancel()
            throw new SkillError('The skill request is too large.')
          }
          chunks.push(part.value)
        }
      } finally {
        reader.releaseLock()
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      let input: unknown
      try {
        input = JSON.parse(
          new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
            bytes,
          ),
        )
      } catch {
        throw new SkillError('Provide a valid skill command.')
      }
      return json(await skills.command(input))
    }
    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    if (error instanceof SkillError)
      return json({ error: error.message }, error.status)
    if (error instanceof z.ZodError)
      return json({ error: 'Check the skill fields and try again.' }, 400)
    throw error
  }
}
