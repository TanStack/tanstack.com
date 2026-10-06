import { hasChatAccess } from '~/chat/access.server'
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { getAuthService } from '~/auth/index.server'
import { jsonError, readJsonBody, validateSameOriginRequest } from '~/utils/api-boundary.server'
import { composerDraftApi } from '~/chat/server/composer-drafts'

async function handle(request: Request) {
  if (request.method === 'POST') {
    const rejection = validateSameOriginRequest(request)
    if (rejection) return jsonError(rejection.message, rejection.status)
  }
  const user = await getAuthService().getCurrentUser(request)
  if (!user) return jsonError('Sign in to continue.', 401)
  if (!await hasChatAccess(user))
    return jsonError('Chat access is unavailable.', 403)
  const scope = new URL(request.url).searchParams.get('scope') ?? ''
  const body = request.method === 'POST'
    ? await readJsonBody(request, { maxContentLength: 600_000 })
    : undefined
  if (body && !body.success) return jsonError(body.error.message, body.error.status)
  try {
    return await composerDraftApi(request, user.userId, scope, body?.success ? body.body : undefined)
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError('Invalid draft request.', 400)
    throw error
  }
}
export const Route = createFileRoute('/api/chat/draft')({
  server: { handlers: {
    GET: ({ request }) => handle(request),
    POST: ({ request }) => handle(request),
  } },
})
