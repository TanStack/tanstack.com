import { hasChatAccess } from '../access.server'
import { scheduleCommandSchema } from '../core/schedules'
import {
  readWorkspacePolicy,
  WorkspacePolicyError,
} from '../workspace-policy.server'
import { parseRetrySource } from '../core/retry-source'
import { conversationControlApi } from './conversation-control-api'
import { conversationSendApi } from './conversation-send-api'
import {
  readConversationWorkflowWorker,
  readConversationWorkflowOwner,
  readConversationLifecycle,
  readConversationRunContext,
} from './conversation-database'
import {
  markConversationRead,
  readConversationReadVersion,
} from './bot-activity'
import { readWorkspaceJson } from './workspace-request'
import { WorkspaceBodyError } from './workspace-request'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import {
  jsonError,
  jsonResponse,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import {
  resolveConversationIdentity,
  ConversationIdentityError,
} from '../conversation-identity.server'
import type { ConversationEnvironment } from './conversation-environment'
import { transcriptNavigationRequest } from '../core/transcript-navigation'
import { conversationReadApi } from './conversation-read-api'

const json = (value: unknown, status = 200) => jsonResponse(value, { status })

function isConversationNamespace(
  value: unknown,
): value is ConversationEnvironment['CONVERSATIONS'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
}

export async function handleConversationRead(
  request: Request,
  conversationId: string,
  operation: string,
  target: 'conversation' | 'bot' = 'conversation',
): Promise<Response> {
  if (request.method !== 'GET') return jsonError('Method not allowed.', 405)
  if (
    ![
      'history',
      'stream',
      'send-receipt',
      'navigation',
      'archive',
      'runs',
      'task-usage',
      'action-evidence',
      'copy-boundary',
      'retry-source',
      'delegations',
      'schedules',
    ].includes(operation)
  )
    return jsonError('Not found.', 404)
  const user = await getAuthService().getCurrentUser(request)
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
    const identity = await resolveConversationIdentity({
      userId: user.userId,
      workspaceId: workspace.data,
      ...(target === 'bot' ? { botId: conversationId } : { conversationId }),
    })
    const env = await getHostRuntimeEnv()
    if (!isConversationNamespace(env?.CONVERSATIONS))
      return jsonError('Conversation storage is unavailable.', 503)
    const stub = env.CONVERSATIONS.getByName(identity.conversationId)
    await stub.bindIdentity(identity)
    if (operation === 'schedules')
      return json(await stub.scheduleSnapshot(identity))
    if (operation === 'delegations') {
      if (url.searchParams.get('view') === 'history') {
        if (
          url.searchParams.has('task') ||
          url.searchParams.getAll('view').length !== 1 ||
          url.searchParams.getAll('before').length > 1 ||
          url.searchParams.getAll('limit').length > 1
        )
          return json({ error: 'Choose one task history page.' }, 400)
        const result = await stub.delegationHistory(identity, {
          ...(url.searchParams.has('before')
            ? { beforeId: z.uuid().parse(url.searchParams.get('before')) }
            : {}),
          ...(url.searchParams.has('limit')
            ? {
                limit: z.coerce
                  .number()
                  .int()
                  .min(1)
                  .max(25)
                  .parse(url.searchParams.get('limit')),
              }
            : {}),
        })
        return result.ok
          ? json(result.page)
          : json({ error: result.error }, result.status)
      }
      if (url.searchParams.getAll('task').length !== 1)
        return json({ error: 'Choose one parent task.' }, 400)
      const taskId = z
        .string()
        .min(1)
        .max(128)
        .parse(url.searchParams.get('task'))
      return json(await stub.taskDelegations(identity, taskId))
    }
    if (operation === 'task-usage') {
      if (
        url.searchParams.getAll('view').length > 1 ||
        (url.searchParams.has('view') &&
          url.searchParams.get('view') !== 'history')
      )
        return json({ error: 'Choose a valid usage view.' }, 400)
      if (url.searchParams.getAll('task').length !== 1)
        return json({ error: 'Choose one task.' }, 400)
      const taskId = z
        .string()
        .min(1)
        .max(128)
        .parse(url.searchParams.get('task'))
      const usage =
        url.searchParams.get('view') === 'history'
          ? await stub.historicalTaskUsage(identity, taskId)
          : await stub.taskUsage(identity, taskId)
      return usage
        ? json(usage)
        : json(
            {
              error:
                url.searchParams.get('view') === 'history'
                  ? 'This task has no retained delegation records.'
                  : 'This task is no longer current.',
            },
            404,
          )
    }
    if (operation === 'runs') {
      const rawLimit = url.searchParams.get('limit')
      const cursor = url.searchParams.get('cursor')
      if (
        url.searchParams.getAll('limit').length > 1 ||
        url.searchParams.getAll('cursor').length > 1 ||
        (rawLimit !== null &&
          (!/^[1-9][0-9]*$/.test(rawLimit) || Number(rawLimit) > 50)) ||
        (cursor !== null && (!cursor.length || cursor.length > 4096))
      )
        return json({ error: 'Invalid run history pagination.' }, 400)
      try {
        return json(
          await stub.runHistory(identity, {
            ...(rawLimit === null ? {} : { limit: Number(rawLimit) }),
            ...(cursor === null ? {} : { cursor }),
          }),
        )
      } catch (error) {
        // RPC preserves the safe message, not necessarily a custom Error class.
        if (
          error instanceof Error &&
          error.message === 'Invalid run history cursor.'
        )
          return json({ error: 'Invalid run history cursor.' }, 400)
        throw error
      }
    }
    if (operation === 'action-evidence') {
      return json(JSON.parse(await stub.actionEvidenceJson(identity)))
    }
    if (operation === 'retry-source') {
      const lifecycle = await readConversationLifecycle(
        identity.botId,
        identity.conversationId,
      )
      if (!lifecycle.bot || lifecycle.bot.deleted_at !== null)
        return json(
          { error: 'Restore this conversation from Trash first.' },
          409,
        )
      const message = url.searchParams.get('message')
      if (
        [...url.searchParams.keys()].some(
          (key) => !['message', 'workspaceId'].includes(key),
        ) ||
        url.searchParams.getAll('message').length !== 1 ||
        !message ||
        message.length > 128
      )
        return json({ error: 'Choose one request to try again.' }, 400)
      const policy = await readWorkspacePolicy(
        identity.workspaceId,
        identity.userId,
      )
      const result = z
        .discriminatedUnion('ok', [
          z.strictObject({
            ok: z.literal(true),
            source: z.unknown().transform(parseRetrySource),
          }),
          z.strictObject({
            ok: z.literal(false),
            status: z.number().int().min(400).max(599),
            code: z.string(),
            error: z.string(),
          }),
        ])
        .parse(
          JSON.parse(
            await stub.captureRetrySourceJson(identity, message, {
              policy,
              fixture: false,
            }),
          ),
        )
      return json(result, result.ok ? 200 : result.status)
    }
    if (operation === 'copy-boundary' && request.method === 'GET') {
      const lifecycle = await readConversationLifecycle(
        identity.botId,
        identity.conversationId,
      )
      if (!lifecycle.bot || lifecycle.bot.deleted_at !== null)
        return json(
          { error: 'Restore this conversation from Trash before copying it.' },
          409,
        )
      const message = url.searchParams.get('message')
      const side = url.searchParams.get('side')
      if (
        (message !== null && (!message || message.length > 128)) ||
        url.searchParams.getAll('message').length > 1 ||
        url.searchParams.getAll('side').length > 1 ||
        (side !== null && (side !== 'before' || !message))
      )
        return json({ error: 'Invalid message link.' }, 400)
      const result =
        side === 'before'
          ? await stub.copyBoundary(message!, side)
          : await stub.copyBoundary(message ?? undefined)
      return json(result, result.ok ? 200 : result.status)
    }
    if (operation === 'navigation') {
      const before = url.searchParams.get('before')
      if (
        [...url.searchParams.keys()].some(
          (key) => !['before', 'epoch', 'workspaceId'].includes(key),
        ) ||
        url.searchParams.getAll('before').length > 1 ||
        url.searchParams.getAll('epoch').length > 1 ||
        (before !== null && !/^[1-9][0-9]*$/.test(before))
      )
        return jsonError('Invalid history cursor.', 400)
      const parsed = transcriptNavigationRequest.safeParse({
        ...(before === null ? {} : { before: Number(before) }),
        ...(url.searchParams.has('epoch')
          ? { epoch: url.searchParams.get('epoch') }
          : {}),
      })
      if (!parsed.success) return jsonError('Invalid history cursor.', 400)
      const result = await stub.transcriptNavigation(parsed.data)
      return result.ok
        ? jsonResponse(result.page)
        : jsonError(result.error, result.status)
    }
    if (operation === 'archive') {
      const message = url.searchParams.get('message')
      if (message !== null) {
        if (!message || message.length > 128)
          return jsonError('Invalid message link.', 400)
        return jsonResponse(await stub.archivedMessage(message))
      }
      const before = url.searchParams.get('before')
      if (
        before !== null &&
        (!/^[1-9][0-9]*$/.test(before) || !Number.isSafeInteger(Number(before)))
      )
        return jsonError('Invalid history cursor.', 400)
      return jsonResponse(
        await stub.archivedHistory(
          before === null ? undefined : Number(before),
        ),
      )
    }
    if (operation === 'send-receipt') {
      const id = z
        .string()
        .min(1)
        .max(128)
        .safeParse(url.searchParams.get('message'))
      if (!id.success) return jsonError('Choose a request.', 400)
      return jsonResponse(await stub.sendReceipt(id.data))
    }
    return (
      (await conversationReadApi(
        request,
        operation,
        stub,
        operation === 'history'
          ? await readConversationWorkflowWorker(identity.conversationId)
          : undefined,
      )) ?? jsonError('Not found.', 404)
    )
  } catch (error) {
    if (error instanceof z.ZodError)
      return jsonError('Check the conversation request and try again.', 400)
    if (
      error instanceof ConversationIdentityError ||
      error instanceof WorkspacePolicyError
    )
      return jsonError(error.message, error.status)
    throw error
  }
}

export async function handleConversationSend(
  request: Request,
  conversationId: string,
  operation: string,
  target: 'conversation' | 'bot' = 'conversation',
): Promise<Response> {
  if (request.method !== 'POST') return jsonError('Method not allowed.', 405)
  if (
    ![
      'send',
      'read',
      'stop',
      'queue',
      'reset',
      'dismiss-task',
      'continue-task',
      'approval',
      'delegations',
      'schedules',
    ].includes(operation)
  )
    return jsonError('Not found.', 404)
  const originError = validateSameOriginRequest(request)
  if (originError) return jsonError(originError.message, originError.status)
  const startedAt = Date.now()
  const timings: Record<string, number> = {}
  const mark = (phase: string) => {
    timings[phase] = Date.now() - startedAt
  }
  const user = await getAuthService().getCurrentUser(request)
  mark('authentication')
  if (!user) return jsonError('Sign in to continue.', 401)
  if (!(await hasChatAccess(user)))
    return jsonError('Chat access is unavailable.', 403)
  mark('access')
  const url = new URL(request.url)
  const workspace = z
    .string()
    .min(1)
    .max(1000)
    .safeParse(url.searchParams.get('workspaceId'))
  if (!workspace.success || url.searchParams.getAll('workspaceId').length !== 1)
    return jsonError('Choose a workspace.', 400)
  try {
    const identity = await resolveConversationIdentity({
      userId: user.userId,
      workspaceId: workspace.data,
      ...(target === 'bot' ? { botId: conversationId } : { conversationId }),
    })
    mark('identity')
    if (operation === 'read') {
      const { version } = z
        .object({
          version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        })
        .strict()
        .parse(await readWorkspaceJson(request))
      await markConversationRead(
        workspace.data,
        user.userId,
        identity.conversationId,
        version,
      )
      return jsonResponse({
        ok: true,
        readVersion: await readConversationReadVersion(
          workspace.data,
          user.userId,
          identity.conversationId,
        ),
      })
    }
    // These reads share the freshly authorized identity but do not depend on
    // each other. Settle them before releasing the request's database context.
    const [ownerRead, lifecycleRead, contextRead] = await Promise.allSettled([
      readConversationWorkflowOwner(identity.conversationId),
      readConversationLifecycle(identity.botId, identity.conversationId),
      operation === 'send' ? readConversationRunContext(identity) : undefined,
    ])
    mark('metadata')
    if (ownerRead.status === 'rejected') throw ownerRead.reason
    if (ownerRead.value)
      return jsonError(
        'Manage this workflow step from its owning conversation.',
        409,
      )
    if (lifecycleRead.status === 'rejected') throw lifecycleRead.reason
    const lifecycle = lifecycleRead.value
    if (!lifecycle.bot) throw new ConversationIdentityError()
    if (
      operation === 'send' &&
      (lifecycle.bot.deleted_at !== null ||
        lifecycle.bot.archived_at !== null ||
        lifecycle.thread?.archived_at != null)
    )
      return jsonError(
        'Restore or unarchive this conversation before starting or changing its work.',
        409,
      )
    const env = await getHostRuntimeEnv()
    if (!isConversationNamespace(env?.CONVERSATIONS))
      return jsonError('Conversation storage is unavailable.', 503)
    const stub = env.CONVERSATIONS.getByName(identity.conversationId)
    // begin authorizes the supplied server identity before admission and
    // rechecks it after preparation. Read/control RPCs still need binding.
    if (operation !== 'send') await stub.bindIdentity(identity)
    if (operation === 'delegations') {
      const command = z
        .strictObject({
          type: z.literal('stop'),
          taskId: z.string().min(1).max(128),
          id: z.uuid(),
        })
        .parse(await readWorkspaceJson(request))
      try {
        await stub.cancelDelegatedTask(identity, command.id, command.taskId)
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Delegated task not found.'
        )
          return json({ error: error.message }, 404)
        if (
          error instanceof Error &&
          error.message === 'This child does not belong to the active task.'
        )
          return json({ error: error.message }, 409)
        throw error
      }
      return json(await stub.taskDelegations(identity, command.taskId))
    }
    if (operation === 'schedules') {
      const result = await stub.changeSchedule(
        identity,
        scheduleCommandSchema.parse(await readWorkspaceJson(request)),
      )
      return result.ok
        ? json(result.snapshot)
        : json({ error: result.error }, result.status)
    }
    const loadContext = async () => {
      if (contextRead.status === 'rejected') throw contextRead.reason
      return {
        ...(contextRead.value ?? (await readConversationRunContext(identity))),
        conversationId: identity.conversationId,
        fixture: false,
        appOrigin: url.origin,
      }
    }
    if (operation !== 'send')
      return (
        (await conversationControlApi(
          request,
          operation,
          stub,
          {
            ...lifecycle.bot,
            archived_at:
              lifecycle.thread?.archived_at ?? lifecycle.bot.archived_at,
          },
          loadContext,
        )) ?? jsonError('Not found.', 404)
      )

    const context = await loadContext()
    mark('context')
    const response = await conversationSendApi(request, stub, context)
    mark('admission')
    return response
  } catch (error) {
    if (
      error instanceof ConversationIdentityError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the form fields and try again.', 400)
    throw error
  } finally {
    if (operation === 'send')
      console.info(
        JSON.stringify({
          event: 'chat_send_timing',
          timings,
          totalMs: Date.now() - startedAt,
        }),
      )
  }
}
