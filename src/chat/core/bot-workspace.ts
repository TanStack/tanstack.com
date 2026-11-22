import type { Bot } from './types'

export interface WorkspaceBot extends Bot {
  mainConversationId?: string
  version: number
  archived_at: number | null
  deleted_at: number | null
  updated_at: number
  pinned: boolean
  section_id: string | null
  position: number
  tags: string[]
}

export interface BotSection {
  id: string
  name: string
  position: number
  version: number
  sort_override?: 'position' | 'name' | 'created' | 'activity' | 'unread' | null
}

export function isPersonalAssistant(
  bot: Pick<Bot, 'id' | 'workspace_id'>,
): boolean {
  return (
    bot.workspace_id.startsWith('personal:') &&
    bot.id === `assistant:${bot.workspace_id.slice(9)}`
  )
}
