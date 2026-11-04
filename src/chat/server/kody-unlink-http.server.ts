import { hasChatAccess } from '../access.server'
import { eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatKodyLinks } from '~/db/schema'
import { getAuthService } from '~/auth/index.server'
import {
  jsonError,
  jsonResponse,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import {
  getMcpEnvironment,
  McpEnvironmentError,
} from './mcp-environment.server'
import { readCredentials, updateCredentials } from './credentials'
export async function handleKodyUnlink(request: Request): Promise<Response> {
  if (request.method !== 'POST') return jsonError('Method not allowed.', 405)
  const origin = validateSameOriginRequest(request)
  if (origin) return jsonError(origin.message, origin.status)
  const user = await getAuthService().getCurrentUser(request)
  if (!user) return jsonError('Sign in to continue.', 401)
  if (!(await hasChatAccess(user)))
    return jsonError('Chat access is unavailable.', 403)
  try {
    const env = await getMcpEnvironment()
    if ((await readCredentials(env, user.userId))?.kody)
      await updateCredentials(env, user.userId, (existing) => {
        if (!existing) throw new Error('Account settings changed. Try again.')
        const { kody: _kody, ...remaining } = existing
        return remaining
      })
    await db.delete(chatKodyLinks).where(eq(chatKodyLinks.userId, user.userId))
    return jsonResponse({ connected: false })
  } catch (error) {
    if (error instanceof McpEnvironmentError)
      return jsonError(error.message, error.status)
    throw error
  }
}
