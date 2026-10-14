import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatComposerDrafts } from '~/db/schema'

export type CloudDraft = { value: string; revision: number }
const inputSchema = z.strictObject({
  value: z.string().max(128_000),
  revision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
})

// Drafts belong to the authenticated person. Empty values remain tombstones.
export async function composerDraftApi(
  request: Request,
  userId: string,
  scope: string,
  input?: unknown,
) {
  z.string().min(1).max(4000).parse(scope)
  const identity = and(
    eq(chatComposerDrafts.userId, userId),
    eq(chatComposerDrafts.scope, scope),
  )
  const read = async (): Promise<CloudDraft> => {
    const [row] = await db
      .select({
        value: chatComposerDrafts.value,
        revision: chatComposerDrafts.revision,
      })
      .from(chatComposerDrafts)
      .where(identity)
    return row ?? { value: '', revision: 0 }
  }
  const respond = (body: unknown) =>
    Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } })
  if (request.method === 'GET') return respond(await read())
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const value = inputSchema.parse(input)
  const next = {
    value: value.value,
    revision: value.revision + 1,
    updatedAt: Date.now(),
  }
  const returning = {
    value: chatComposerDrafts.value,
    revision: chatComposerDrafts.revision,
  }
  const [saved] =
    value.revision === 0
      ? await db
          .insert(chatComposerDrafts)
          .values({ userId, scope, ...next })
          .onConflictDoUpdate({
            target: [chatComposerDrafts.userId, chatComposerDrafts.scope],
            set: next,
            where: and(identity, eq(chatComposerDrafts.revision, 0)),
          })
          .returning(returning)
      : await db
          .update(chatComposerDrafts)
          .set(next)
          .where(and(identity, eq(chatComposerDrafts.revision, value.revision)))
          .returning(returning)
  return respond({ saved: !!saved, draft: saved ?? (await read()) })
}
