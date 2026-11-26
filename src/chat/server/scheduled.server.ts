import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { recoverWorkspaceSync } from './workspace-sync'
import type { WorkspaceSyncEnvironment } from './workspace-sync'

function isSyncNamespace(
  value: unknown,
): value is NonNullable<WorkspaceSyncEnvironment['WORKSPACE_SYNC']> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
}

/** Original source cron recovery, using the shared host and database context. */
export async function recoverChatWorkspaceSync() {
  const env = await getHostRuntimeEnv()
  if (!isSyncNamespace(env?.WORKSPACE_SYNC))
    throw new Error('Workspace sync is unavailable.')
  await recoverWorkspaceSync({ WORKSPACE_SYNC: env.WORKSPACE_SYNC })
}
