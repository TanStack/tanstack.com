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
import { readKodyAccount } from './kody-account'
import { syncKodyAccount } from './kody-sync'
import {
  searchKodyCommunity,
  getKodyCommunityListing,
  KodyCommunityError,
} from './kody-community'
import { readKodyUsage, KodyUsageError } from './kody-usage'
import {
  listKodyMailInboxes,
  listKodyMailMessages,
  getKodyMailMessage,
  KodyMailError,
} from './kody-mail'
import {
  readKodyPackageDocument,
  KodyPackageDocumentError,
} from './kody-package-document'
import { kodyPackageDocumentKindSchema } from '../core/kody-package-document'
import { readKodyResources } from './kody-resources'
import { kodyResourceKindSchema } from '../core/kody-resources'
import { KodyRunError, readKodyRun } from './kody-run'
import { readKodyRunHistory } from './kody-run-history'
import { kodyRunHistoryFilterSchema } from '../core/kody-run-history'
import { searchKodyMemory, getKodyMemory, KodyMemoryError } from './kody-memory'
export async function handleKodyAccount(
  request: Request,
  operation:
    | 'account'
    | 'sync'
    | 'community'
    | 'usage'
    | 'mail-inboxes'
    | 'mail-messages'
    | 'package-document'
    | 'resources'
    | 'runs'
    | 'memories',
  listingId?: string,
): Promise<Response> {
  if (request.method !== (operation === 'sync' ? 'POST' : 'GET'))
    return jsonError('Method not allowed.', 405)
  if (request.method === 'POST') {
    const origin = validateSameOriginRequest(request)
    if (origin) return jsonError(origin.message, origin.status)
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
    if (operation === 'account' && !policy.allowKody)
      return jsonError('Kody is unavailable here.', 403)
    const host = await getHostRuntimeEnv(),
      origin = host?.KODY_ORIGIN ?? process.env.KODY_ORIGIN
    if (typeof origin !== 'string' || !origin)
      return jsonError('Integrations are not configured.', 503)
    const env = { ...(await getMcpEnvironment()), KODY_ORIGIN: origin }
    if (operation === 'memories') {
      const scope = { workspaceId: workspace.data, userId: user.userId },
        options = { policy, fixture: false },
        signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)])
      return jsonResponse(
        listingId === undefined
          ? await searchKodyMemory(
              env,
              scope,
              options,
              query.get('query') ?? '',
              signal,
            )
          : await getKodyMemory(env, scope, options, listingId, signal),
      )
    }
    if (operation === 'runs') {
      if (listingId !== undefined) {
        if (!policy.allowKody)
          return jsonError('Kody is unavailable here.', 403)
        return jsonResponse(
          await readKodyRun(
            env,
            user.userId,
            listingId,
            AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
          ),
        )
      }
      const filter = kodyRunHistoryFilterSchema.parse({
        ...(query.has('triage') ? { triage: query.get('triage') } : {}),
        ...(query.has('status') ? { status: query.get('status') } : {}),
        ...(query.has('surface') ? { surface: query.get('surface') } : {}),
        ...(query.has('cursor') ? { cursor: query.get('cursor') } : {}),
      })
      return jsonResponse(
        await readKodyRunHistory(
          env,
          { workspaceId: workspace.data, userId: user.userId },
          { policy, fixture: false },
          filter,
          AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
        ),
      )
    }
    if (operation === 'resources')
      return jsonResponse(
        await readKodyResources(
          env,
          { workspaceId: workspace.data, userId: user.userId },
          { policy, fixture: false },
          kodyResourceKindSchema.parse(listingId),
          AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
        ),
      )
    if (operation === 'package-document')
      return jsonResponse(
        await readKodyPackageDocument(
          env,
          { workspaceId: workspace.data, userId: user.userId },
          { policy, fixture: false },
          z.uuid().parse(listingId),
          kodyPackageDocumentKindSchema.parse(query.get('kind')),
          AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
        ),
      )
    if (operation === 'mail-inboxes')
      return jsonResponse(
        await listKodyMailInboxes(
          env,
          { workspaceId: workspace.data, userId: user.userId },
          { policy, fixture: false },
          AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
        ),
      )
    if (operation === 'mail-messages') {
      const scope = { workspaceId: workspace.data, userId: user.userId },
        options = { policy, fixture: false },
        signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)])
      return jsonResponse(
        listingId === undefined
          ? await listKodyMailMessages(
              env,
              scope,
              options,
              {
                ...(query.has('inboxId')
                  ? { inboxId: query.get('inboxId') ?? '' }
                  : {}),
                ...(query.has('query')
                  ? { query: query.get('query') ?? '' }
                  : {}),
              },
              signal,
            )
          : await getKodyMailMessage(env, scope, options, listingId, signal),
      )
    }
    if (operation === 'usage')
      return jsonResponse(
        await readKodyUsage(
          env,
          { workspaceId: workspace.data, userId: user.userId },
          { policy, fixture: false },
          AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
        ),
      )
    if (operation === 'community') {
      const scope = { workspaceId: workspace.data, userId: user.userId },
        options = { policy, fixture: false }
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(30000),
      ])
      return jsonResponse(
        listingId === undefined
          ? await searchKodyCommunity(
              env,
              scope,
              options,
              {
                query: query.get('query') ?? '',
                ...(query.has('category')
                  ? { category: query.get('category') }
                  : {}),
                ...(query.has('sort') ? { sort: query.get('sort') } : {}),
              },
              signal,
            )
          : await getKodyCommunityListing(
              env,
              scope,
              options,
              listingId,
              signal,
            ),
      )
    }
    if (operation === 'sync')
      return jsonResponse({
        changed: await syncKodyAccount(
          env,
          { workspaceId: workspace.data, userId: user.userId },
          { policy, fixture: false },
        ),
      })
    return jsonResponse(
      await readKodyAccount(
        env,
        user.userId,
        workspace.data,
        AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
      ),
    )
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof McpEnvironmentError ||
      error instanceof KodyCommunityError ||
      error instanceof KodyUsageError ||
      error instanceof KodyMailError ||
      error instanceof KodyPackageDocumentError ||
      error instanceof KodyRunError ||
      error instanceof KodyMemoryError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError) return jsonError('Invalid request.', 400)
    throw error
  }
}
