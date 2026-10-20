import { eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatConversationThreads } from '~/db/schema'
import { resolveConversationIdentity } from './conversation-identity.server'
import { threadSourceSchema } from './thread-context'

/** An inherited snapshot is evidence, not a live transcript or permission grant. */
export async function readThreadContext(
  input: Parameters<typeof resolveConversationIdentity>[0],
) {
  const identity = await resolveConversationIdentity(input)
  const [thread] = await db
    .select()
    .from(chatConversationThreads)
    .where(eq(chatConversationThreads.conversationId, identity.conversationId))
  if (!thread) return undefined
  return {
    parentConversationId: thread.parentConversationId,
    sourceMessageId: thread.sourceMessageId,
    source: threadSourceSchema.parse(thread.source),
  }
}
