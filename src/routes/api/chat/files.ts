import { hasChatAccess } from '~/chat/access.server'
import { z } from 'zod'
import type { FileScope, DraftFileScope } from '~/chat/core/files'
import { createFileRoute } from '@tanstack/react-router'
import { getAuthService } from '~/auth/index.server'
import {
  jsonError,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import { fileApi } from '~/chat/server/file-api'
import { getFileEnvironment } from '~/chat/server/file-environment.server'
import { SavedFileError } from '~/chat/server/saved-file-contract'
const requestSchema = z
  .object({
    workspaceId: z.string().min(1).max(1000),
    botId: z.string().min(1).max(1000).optional(),
    conversationId: z.string().min(1).max(1000).optional(),
    draftId: z.string().uuid().optional(),
    id: z.string().uuid().optional(),
    content: z.enum(['0', '1']).default('0'),
  })
  .superRefine((value, ctx) => {
    if (
      value.draftId
        ? Boolean(value.botId || value.conversationId)
        : !value.botId
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a draft or a conversation.',
      })
    if (value.content === '1' && !value.id)
      ctx.addIssue({ code: 'custom', message: 'Choose a file.' })
  })
export async function handleFileRequest(request: Request) {
  if (request.method === 'PUT') {
    const rejection = validateSameOriginRequest(request)
    if (rejection) return jsonError(rejection.message, rejection.status)
  }
  const user = await getAuthService().getCurrentUser(request)
  if (!user) return jsonError('Sign in to continue.', 401)
  if (
    !await hasChatAccess(user)
  )
    return jsonError('Chat access is unavailable.', 403)
  const parsed = requestSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) return jsonError('Invalid file request.', 400)
  const value = parsed.data
  let scope: FileScope | DraftFileScope
  if (value.draftId)
    scope = {
      workspaceId: value.workspaceId,
      userId: user.userId,
      draftId: value.draftId,
    }
  else {
    if (!value.botId) return jsonError('Invalid file request.', 400)
    scope = {
      workspaceId: value.workspaceId,
      userId: user.userId,
      botId: value.botId,
      conversationId: value.conversationId,
    }
  }

  try {
    return await fileApi(
      request,
      await getFileEnvironment(),
      scope,
      value.id,
      value.content === '1',
    )
  } catch (error) {
    if (error instanceof SavedFileError)
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Invalid file request.', 400)
    throw error
  }
}
export const Route = createFileRoute('/api/chat/files')({
  server: {
    handlers: {
      GET: ({ request }) => handleFileRequest(request),
      PUT: ({ request }) => handleFileRequest(request),
    },
  },
})
