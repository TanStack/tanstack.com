import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import { jsonError, jsonResponse } from '~/utils/api-boundary.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { openPersonalChatWorkspace } from '../workspace.server'
import { WorkspacePolicyError } from '../workspace-policy.server'
import {
  getMcpEnvironment,
  McpEnvironmentError,
} from './mcp-environment.server'
import { readBootstrap } from './bootstrap'
import { OnboardingError } from './onboarding'
export async function handleBootstrap(request: Request): Promise<Response> {
  const user = await getAuthService().getCurrentUser(request)
  if (!user) return jsonError('Sign in to continue.', 401)
  if (!(await hasChatAccess(user)))
    return jsonError('Chat access is unavailable.', 403)
  const query = new URL(request.url).searchParams
  const workspace = z
    .string()
    .min(1)
    .max(1000)
    .safeParse(query.get('workspaceId'))
  if (!workspace.success || query.getAll('workspaceId').length !== 1)
    return jsonError('Choose a workspace.', 400)
  try {
    const host = await getHostRuntimeEnv()
    const read = (key: string) => {
      const value = host?.[key] ?? process.env[key]
      return typeof value === 'string' ? value : undefined
    }
    const model = read('INCLUDED_MODEL'),
      origin = read('KODY_ORIGIN')
    if (!model || !origin)
      return jsonError('Chat models and integrations are not configured.', 503)
    const env = {
      ...(await getMcpEnvironment()),
      INCLUDED_MODEL: model,
      KODY_ORIGIN: origin,
      APP_MODE: read('APP_MODE'),
      GUM_DEV_EXECUTION: read('GUM_DEV_EXECUTION'),
      UNLIMITED_USAGE_EMAILS: read('UNLIMITED_USAGE_EMAILS'),
    }
    await openPersonalChatWorkspace(user.userId)
    return jsonResponse(await readBootstrap(request, env, user, workspace.data))
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof OnboardingError ||
      error instanceof McpEnvironmentError
    )
      return jsonError(error.message, error.status)
    throw error
  }
}
