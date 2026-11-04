import { scheduleHostRuntimeTask } from '~/server/runtime/host.server'
import { openPersonalChatWorkspace } from '../workspace.server'
import { readWorkspacePolicy } from '../workspace-policy.server'
import { getKodyEnvironment } from './kody-environment.server'
import { syncKodyAccount } from './kody-sync'

/** Carry over the source OAuth callback's automatic inventory refresh. */
export async function syncConnectedKodyAccount(userId: string) {
  const task = async () => {
    try {
      const { workspace } = await openPersonalChatWorkspace(userId)
      const policy = await readWorkspacePolicy(workspace.id, userId)
      await syncKodyAccount(
        await getKodyEnvironment(),
        { workspaceId: workspace.id, userId },
        { policy, fixture: false },
      )
    } catch (error) {
      // A catalog refresh failure must not undo a successful connection.
      console.error('Could not sync the connected Kody account.', error)
    }
  }
  if (!scheduleHostRuntimeTask(task)) await task()
}
