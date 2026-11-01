import type { WorkspaceIndex } from '../core/workspace-index'
import { readBotSections, readWorkspaceBots } from './bot-workspace-reads'

export async function readWorkspaceIndex(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceIndex> {
  const [bots, sections] = await Promise.all([
    readWorkspaceBots(workspaceId, userId),
    readBotSections(workspaceId, userId),
  ])
  return { workspaceId, userId, bots, sections }
}
