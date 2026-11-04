import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { jsonError, jsonResponse } from '~/utils/api-boundary.server'
import {
  readWorkspacePolicy,
  WorkspacePolicyError,
} from '../workspace-policy.server'
import { syncMembership } from './workspace-sync-projection'
import type { WorkspaceSync } from './workspace-sync-object'

type SyncNamespace = {
  getByName(id: string): Pick<WorkspaceSync, 'snapshot' | 'read'>
}
function isSyncNamespace(value: unknown): value is SyncNamespace {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
}
export async function handleWorkspaceSync(
  request: Request,
  operation: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonError('Method not allowed.', 405)
  if (!['snapshot', 'stream'].includes(operation))
    return jsonError('Not found.', 404)
  const auth = getAuthService()
  const user = await auth.getCurrentUser(request)
  if (!user) return jsonError('Sign in to continue.', 401)
  if (!(await hasChatAccess(user)))
    return jsonError('Chat access is unavailable.', 403)
  const url = new URL(request.url)
  const workspace = z
    .string()
    .min(1)
    .max(1000)
    .safeParse(url.searchParams.get('workspaceId'))
  if (!workspace.success || url.searchParams.getAll('workspaceId').length !== 1)
    return jsonError('Choose a workspace.', 400)
  try {
    await readWorkspacePolicy(workspace.data, user.userId)
    const env = await getHostRuntimeEnv()
    if (!isSyncNamespace(env?.WORKSPACE_SYNC))
      return jsonError('Workspace sync is unavailable.', 503)
    const stub = env.WORKSPACE_SYNC.getByName(workspace.data)
    if (operation === 'snapshot') {
      const before = await syncMembership(workspace.data, user.userId)
      const snapshot = await stub.snapshot(workspace.data, user.userId)
      const after = await syncMembership(workspace.data, user.userId)
      return snapshot && before?.generation === after?.generation && after
        ? jsonResponse(snapshot)
        : jsonError('Workspace not found.', 403)
    }
    const generation = z
      .string()
      .uuid()
      .parse(url.searchParams.get('generation'))
    const offset = z
      .string()
      .min(1)
      .max(200)
      .parse(url.searchParams.get('offset'))
    const params = new URLSearchParams({ offset })
    if (url.searchParams.has('live')) params.set('live', 'true')
    const cursor = url.searchParams.get('cursor')
    if (cursor) params.set('cursor', z.string().max(500).parse(cursor))
    const before = await syncMembership(workspace.data, user.userId)
    const response = await stub.read(
      workspace.data,
      user.userId,
      generation,
      `?${params}`,
    )
    const fresh = await auth.getCurrentUser(request)
    const membership = await syncMembership(workspace.data, user.userId)
    if (
      !fresh ||
      fresh.userId !== user.userId ||
      !membership ||
      before?.generation !== membership.generation
    ) {
      await response.body?.cancel()
      return jsonError('Workspace access changed.', 403)
    }
    return response
  } catch (error) {
    if (error instanceof WorkspacePolicyError)
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Choose a valid stream cursor.', 400)
    throw error
  }
}
