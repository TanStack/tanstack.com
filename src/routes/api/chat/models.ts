import { hasChatAccess } from '~/chat/access.server'
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { getAuthService } from '~/auth/index.server'
import { jsonError, jsonResponse } from '~/utils/api-boundary.server'
import {
  readWorkspacePolicy,
  WorkspacePolicyError,
} from '~/chat/workspace-policy.server'
import { getModelEnvironment } from '~/chat/server/model-environment.server'
import { getRunModelCatalog, RunModelError } from '~/chat/server/run-models'
const workspaceIdSchema = z.string().min(1).max(1000)
export async function handleModelCatalog(request: Request) {
  const user = await getAuthService().getCurrentUser(request)
  if (!user) return jsonError('Sign in to continue.', 401)
  if (
    !await hasChatAccess(user)
  )
    return jsonError('Chat access is unavailable.', 403)
  const parsed = workspaceIdSchema.safeParse(
    new URL(request.url).searchParams.get('workspaceId'),
  )
  if (!parsed.success) return jsonError('Choose a workspace.', 400)
  try {
    const policy = await readWorkspacePolicy(parsed.data, user.userId)
    const env = await getModelEnvironment()
    const catalog = await getRunModelCatalog(env, {
      userId: user.userId,
      policy,
      fixture: false,
    })
    return jsonResponse(catalog, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if (error instanceof WorkspacePolicyError || error instanceof RunModelError)
      return jsonError(error.message, error.status)
    throw error
  }
}
export const Route = createFileRoute('/api/chat/models')({
  server: { handlers: { GET: ({ request }) => handleModelCatalog(request) } },
})
