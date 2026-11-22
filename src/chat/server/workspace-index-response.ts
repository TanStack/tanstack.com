import { jsonError, jsonResponse } from '~/utils/api-boundary.server'
import type { WorkspaceSyncSnapshot } from '../core/workspace-sync'
import { readWorkspaceIndex } from './workspace-index'

/** Original Gum indexResponse semantics: a committed write is not rejected when delivery fails. */
export async function workspaceIndexResponse(
  result: object,
  workspaceId: string,
  userId: string,
  sync?: {
    snapshot(
      workspaceId: string,
      userId: string,
    ): Promise<WorkspaceSyncSnapshot | undefined>
  },
): Promise<Response> {
  if (sync) {
    try {
      const snapshot = await sync.snapshot(workspaceId, userId)
      if (!snapshot) return jsonError('Workspace access changed.', 403)
      return jsonResponse({ ...result, index: snapshot.state, sync: snapshot })
    } catch {
      // The command already committed. Delivery failure must not invite a retry.
      return jsonResponse({ ...result, syncPending: true })
    }
  }
  return jsonResponse({
    ...result,
    index: await readWorkspaceIndex(workspaceId, userId),
  })
}
