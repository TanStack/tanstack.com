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
import {
  refreshToolReferences,
  ToolReferenceError,
} from './tool-reference-catalog'
import {
  refreshKodyReferences,
  listKodyReferences,
  inspectKodyReference,
  KodyReferenceError,
} from './kody-reference-catalog'
import { refreshKodyAccountReferences } from './kody-account-reference-catalog'
import { connectedMcpServers } from './mcp-connections'
import { discoveryIntegration } from './discovery-integrations'
import { mcpCall } from './mcp'
export async function handleReferenceCatalog(
  request: Request,
  operation: 'tools-refresh' | 'kody-refresh' | 'kody-inspect' | 'mcp-contract',
): Promise<Response> {
  if (
    request.method !==
    (operation === 'kody-inspect' || operation === 'mcp-contract'
      ? 'GET'
      : 'POST')
  )
    return jsonError('Method not allowed.', 405)
  if (request.method === 'POST') {
    const originCheck = validateSameOriginRequest(request)
    if (originCheck) return jsonError(originCheck.message, originCheck.status)
  }
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
    if (operation === 'mcp-contract') {
      const serverId = query.get('serverId'),
        entity = query.get('entity')
      if (!serverId || !entity || entity.length > 320)
        return jsonError('Provide a server and contract reference.', 400)
      const connections = await connectedMcpServers(env, user.userId, policy)
      const connection = connections.find((c) => c.id === serverId)
      if (!connection?.trustedForDiscovery)
        return jsonError('No trusted discovery connection.', 403)
      const integration = discoveryIntegration(connection.discoveryIntegration)
      if (!integration?.describe)
        return jsonError('This server has no paired contract reader.', 422)
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(30000),
      ])
      const contract = await integration.describe(entity, (name, args) =>
        mcpCall(connection, name, args, signal),
      )
      return jsonResponse({ serverId: connection.id, entity, contract })
    }
    if (operation === 'tools-refresh') {
      const input = z
        .object({ serverId: z.string().min(1).max(200) })
        .strict()
        .parse(await readWorkspaceJson(request))
      return jsonResponse(
        await refreshToolReferences(
          env,
          scope,
          options,
          input.serverId,
          AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
        ),
      )
    }
    if (operation === 'kody-refresh') {
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(90000),
      ])
      const [actions] = await Promise.allSettled([
        refreshKodyReferences(env, scope, options, signal),
        refreshKodyAccountReferences(env, scope, options, signal),
      ])
      if (actions.status === 'rejected') throw actions.reason
      return jsonResponse(
        await listKodyReferences(env, scope, { ...options, query: '' }),
      )
    }
    const input = z
      .object({
        entity: z
          .string()
          .min(1)
          .max(500)
          .regex(
            /^(capability|package|integration|mcp-server|job|workflow-run|run):\S+$/,
          ),
        operation: z.string().min(1).max(200).optional(),
      })
      .strict()
      .parse({
        entity: query.get('entity'),
        ...(query.has('operation')
          ? { operation: query.get('operation') }
          : {}),
      })
    return jsonResponse(
      await inspectKodyReference(
        env,
        scope,
        input,
        options,
        AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
      ),
    )
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof WorkspaceBodyError ||
      error instanceof McpEnvironmentError ||
      error instanceof ToolReferenceError ||
      error instanceof KodyReferenceError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError) return jsonError('Invalid request.', 400)
    throw error
  }
}
