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
import { changeKodyJob, KodyJobError } from './kody-job-control'
import { addKodyServer, KodyServerAddError } from './kody-server-add'
import {
  checkKodyServer,
  reconnectKodyServer,
  setKodyServerEnabled,
  KodyServerError,
} from './kody-server-control'
import { invalidateKodyCatalogs } from './kody-sync'
import { kodyJobChangeSchema } from '../core/kody-jobs'
import {
  kodyServerAddSchema,
  kodyServerCheckSchema,
  kodyServerEnabledSchema,
  kodyServerReconnectSchema,
} from '../core/kody-servers'
import { changeKodyRunTriage } from './kody-run-triage'
import { KodyRunError } from './kody-run'
export async function handleKodyControl(
  request: Request,
  operation:
    | 'job-enabled'
    | 'server-add'
    | 'server-enabled'
    | 'server-reconnect'
    | 'server-check'
    | 'run-triage',
  id?: string,
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
    if (!policy.allowKody) return jsonError('Kody is unavailable here.', 403)
    const host = await getHostRuntimeEnv(),
      origin = host?.KODY_ORIGIN ?? process.env.KODY_ORIGIN
    if (typeof origin !== 'string' || !origin)
      return jsonError('Integrations are not configured.', 503)
    const env = { ...(await getMcpEnvironment()), KODY_ORIGIN: origin },
      scope = { workspaceId: workspace.data, userId: user.userId },
      options = { policy, fixture: false }
    const input = await readWorkspaceJson(request)
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(operation === 'server-add' ? 60000 : 30000),
    ])
    if (operation === 'run-triage')
      return jsonResponse(
        await changeKodyRunTriage(
          env,
          scope,
          options,
          z.string().min(1).parse(id),
          input,
          signal,
        ),
      )
    if (operation === 'job-enabled')
      return jsonResponse(
        await changeKodyJob(
          env,
          scope,
          z.string().min(1).max(200).parse(id),
          kodyJobChangeSchema.parse(input),
          signal,
        ),
      )
    if (operation === 'server-add') {
      const result = await addKodyServer(
        env,
        scope,
        options,
        kodyServerAddSchema.parse(input),
        signal,
      )
      await invalidateKodyCatalogs(env, user.userId)
      return jsonResponse(result)
    }
    const serverId = z.uuid().parse(id)
    if (operation === 'server-enabled') {
      const result = await setKodyServerEnabled(
        env,
        scope,
        serverId,
        kodyServerEnabledSchema.parse(input),
        signal,
      )
      if (result.changed) await invalidateKodyCatalogs(env, user.userId)
      return jsonResponse(result)
    }
    if (operation === 'server-reconnect') {
      const result = await reconnectKodyServer(
        env,
        scope,
        serverId,
        kodyServerReconnectSchema.parse(input),
        signal,
      )
      if (result.changed) await invalidateKodyCatalogs(env, user.userId)
      return jsonResponse(result)
    }
    const result = await checkKodyServer(
      env,
      scope,
      serverId,
      kodyServerCheckSchema.parse(input),
      signal,
    )
    await invalidateKodyCatalogs(env, user.userId)
    return jsonResponse(result)
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof WorkspaceBodyError ||
      error instanceof McpEnvironmentError ||
      error instanceof KodyJobError ||
      error instanceof KodyServerError ||
      error instanceof KodyServerAddError ||
      error instanceof KodyRunError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError) return jsonError('Invalid request.', 400)
    throw error
  }
}
