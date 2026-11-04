import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import {
  jsonError,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import { deviceAccountApi, deviceTransportApi } from './connected-devices'
import { WorkspaceBodyError } from './workspace-request'
export async function handleDeviceAccount(request: Request): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method))
    return jsonError('Method not allowed.', 405)
  if (request.method === 'POST') {
    const origin = validateSameOriginRequest(request)
    if (origin) return jsonError(origin.message, origin.status)
  }
  const user = await getAuthService().getCurrentUser(request)
  if (!user) return jsonError('Sign in to continue.', 401)
  if (!(await hasChatAccess(user)))
    return jsonError('Chat access is unavailable.', 403)
  try {
    return await deviceAccountApi(request, user.userId)
  } catch (error) {
    if (error instanceof WorkspaceBodyError)
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Invalid device request.', 400)
    throw error
  }
}
export async function handleDeviceTransport(
  request: Request,
): Promise<Response> {
  try {
    return await deviceTransportApi(request)
  } catch (error) {
    if (error instanceof WorkspaceBodyError)
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Invalid device request.', 400)
    throw error
  }
}
