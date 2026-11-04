import type { WorkspaceBot } from './bot-workspace'

export type ConversationAction =
  | { type: 'rename'; name: string }
  | { type: 'archive'; archived: boolean }
  | { type: 'pin'; pinned: boolean }

/** Shared by the quick menu and command palette. The server remains the authority. */
export function conversationActionRequest(
  bot: Pick<WorkspaceBot, 'id' | 'version' | 'deleted_at'>,
  action: ConversationAction,
) {
  if (bot.deleted_at !== null)
    throw new Error('Restore this conversation before changing it.')
  const path = `bots/${encodeURIComponent(bot.id)}`
  if (action.type === 'pin')
    return {
      path: `${path}/organization`,
      method: 'PATCH' as const,
      body: { pinned: action.pinned },
    }
  if (action.type === 'archive')
    return {
      path,
      method: 'PATCH' as const,
      body: { version: bot.version, archived: action.archived },
    }
  const name = action.name.trim()
  if (!name || name.length > 60)
    throw new Error('Use a name between 1 and 60 characters.')
  return {
    path,
    method: 'PATCH' as const,
    body: { version: bot.version, name },
  }
}
