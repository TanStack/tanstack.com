import { bulkConversationSchema } from '../core/conversation-bulk-actions'
import type { BotWorkspace } from './bot-workspace'

export async function applyConversationBulkAction(
  botWorkspace: Pick<BotWorkspace, 'patch' | 'organize'>,
  body: unknown,
) {
  const input = bulkConversationSchema.parse(body)
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const bot of input.bots) {
    try {
      if (input.action.type === 'archive')
        await botWorkspace.patch(bot.id, {
          version: bot.version,
          archived: input.action.archived,
        })
      else
        await botWorkspace.organize(
          bot.id,
          input.action.type === 'pin'
            ? { pinned: input.action.pinned }
            : { sectionId: input.action.sectionId, pinned: false },
        )
      succeeded.push(bot.id)
    } catch (error) {
      failed.push({
        id: bot.id,
        error:
          error instanceof Error
            ? error.message
            : 'Could not save this change.',
      })
    }
  }
  return { succeeded, failed }
}
