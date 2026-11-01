import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import { BotWorkspaceError } from './workspace-error'
import type { CopyIdentity } from '../core/conversation-copy'
export interface WorkspaceLifecycleEnvironment {
  CONVERSATIONS: {
    getByName(id: string): {
      bindIdentity(identity: CopyIdentity): Promise<unknown>
      reserveDeletion(id: string): Promise<{
        reserved: boolean
        draining?: boolean
        executionSession?: boolean
      }>
      releaseDeletion(id: string): Promise<unknown>
    }
  }
}
/** Ported lifecycle reservation from BotWorkspace. Callers validate their mutation before reserving. */
export async function reserveWorkspaceConversations(
  env: WorkspaceLifecycleEnvironment,
  workspaceId: string,
  ids: string[],
) {
  const expiresAt = Date.now() + 50_000
  const reservationId = crypto.randomUUID()
  const reserved: Array<
    ReturnType<WorkspaceLifecycleEnvironment['CONVERSATIONS']['getByName']>
  > = []
  const release = async () => {
    await Promise.allSettled(
      reserved.map((stub) => stub.releaseDeletion(reservationId)),
    )
  }
  try {
    const conversations = await db.execute<
      { id: string; bot_id: string; user_id: string } & Record<string, unknown>
    >(
      sql`SELECT c.id,c.bot_id,c.user_id FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id WHERE b.workspace_id=${workspaceId} AND c.bot_id IN(SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)) ORDER BY c.created_at,c.id`,
    )
    for (const conversation of conversations) {
      const stub = env.CONVERSATIONS.getByName(conversation.id)
      await stub.bindIdentity({
        conversationId: conversation.id,
        botId: conversation.bot_id,
        userId: conversation.user_id,
        workspaceId,
      })
      let state = await stub.reserveDeletion(reservationId)
      for (
        let attempt = 0;
        !state.reserved &&
        'draining' in state &&
        state.draining &&
        attempt < 40;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250))
        state = await stub.reserveDeletion(reservationId)
      }
      if (!state.reserved)
        throw new BotWorkspaceError(
          'executionSession' in state && state.executionSession
            ? 'Close the active execution session before archiving this conversation.'
            : 'This conversation is still stopping work. Try archiving it again shortly.',
          409,
        )
      reserved.push(stub)
    }
    if (Date.now() >= expiresAt)
      throw new BotWorkspaceError(
        'The lifecycle check took too long. Try again.',
        409,
      )
    return {
      release,
      expiresAt,
      botIds: ids,
      conversationIds: conversations.map((conversation) => conversation.id),
    }
  } catch (error) {
    await release()
    throw error
  }
}
