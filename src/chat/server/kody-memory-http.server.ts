import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import {
  jsonError,
  jsonResponse,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import {
  readWorkspacePolicy,
  WorkspacePolicyError,
} from '../workspace-policy.server'
import {
  getMcpEnvironment,
  McpEnvironmentError,
} from './mcp-environment.server'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
import { KodyMemoryError } from './kody-memory'
import {
  reviewKodyMemoryCreate,
  applyKodyMemoryCreate,
} from './kody-memory-create'
import {
  reviewKodyMemoryChange,
  applyKodyMemoryChange,
} from './kody-memory-change'
export async function handleKodyMemoryMutation(
  request: Request,
  operation: 'review' | 'apply',
  memoryId?: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonError('Method not allowed.', 405)
  const originCheck = validateSameOriginRequest(request)
  if (originCheck) return jsonError(originCheck.message, originCheck.status)
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
    const policy = await readWorkspacePolicy(workspace.data, user.userId)
    const host = await getHostRuntimeEnv(),
      origin = host?.KODY_ORIGIN ?? process.env.KODY_ORIGIN
    if (typeof origin !== 'string' || !origin)
      return jsonError('Integrations are not configured.', 503)
    const env = { ...(await getMcpEnvironment()), KODY_ORIGIN: origin },
      scope = { workspaceId: workspace.data, userId: user.userId },
      options = { policy, fixture: false }
    const input = await readWorkspaceJson(request),
      signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)])
    if (memoryId !== undefined)
      return jsonResponse(
        operation === 'review'
          ? await reviewKodyMemoryChange(
              env,
              scope,
              options,
              memoryId,
              input,
              signal,
            )
          : await applyKodyMemoryChange(
              env,
              scope,
              options,
              memoryId,
              input,
              signal,
            ),
      )
    if (operation === 'review')
      return jsonResponse(
        await reviewKodyMemoryCreate(env, scope, options, input, signal),
      )
    const { token } = z
      .object({ token: z.string().min(1).max(100000) })
      .strict()
      .parse(input)
    return jsonResponse(
      await applyKodyMemoryCreate(env, scope, options, token, signal),
    )
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof WorkspaceBodyError ||
      error instanceof McpEnvironmentError ||
      error instanceof KodyMemoryError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError) return jsonError('Invalid request.', 400)
    throw error
  }
}
