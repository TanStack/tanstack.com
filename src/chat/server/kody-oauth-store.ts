import { and, eq, gt, lt } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatKodyOauthClients, chatKodyOauthPending } from '~/db/schema'
export async function readKodyOauthClient(origin: string) {
  const [client] = await db
    .select({ clientId: chatKodyOauthClients.clientId })
    .from(chatKodyOauthClients)
    .where(eq(chatKodyOauthClients.origin, origin))
  return client?.clientId
}
export async function saveKodyOauthClient(origin: string, clientId: string) {
  await db
    .insert(chatKodyOauthClients)
    .values({ origin, clientId })
    .onConflictDoNothing()
  return readKodyOauthClient(origin)
}
export async function saveKodyOauthPending(
  input: typeof chatKodyOauthPending.$inferInsert,
) {
  await db
    .delete(chatKodyOauthPending)
    .where(lt(chatKodyOauthPending.expiresAt, Date.now()))
  await db.insert(chatKodyOauthPending).values(input)
}
export async function consumeKodyOauthPending(
  stateHash: string,
  userId: string,
) {
  const [pending] = await db
    .delete(chatKodyOauthPending)
    .where(
      and(
        eq(chatKodyOauthPending.stateHash, stateHash),
        eq(chatKodyOauthPending.userId, userId),
        gt(chatKodyOauthPending.expiresAt, Date.now()),
      ),
    )
    .returning({ payload: chatKodyOauthPending.payload })
  return pending?.payload
}
