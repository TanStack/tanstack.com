import { z } from 'zod'
import type { WorkspaceBot } from './bot-workspace'
import { conversationActionRequest } from './conversation-actions'

export const bulkConversationSchema = z
  .object({
    bots: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            version: z.number().int().min(0),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
    action: z.discriminatedUnion('type', [
      z.object({ type: z.literal('pin'), pinned: z.boolean() }).strict(),
      z.object({ type: z.literal('archive'), archived: z.boolean() }).strict(),
      z
        .object({
          type: z.literal('section'),
          sectionId: z.string().min(1).max(200).nullable(),
        })
        .strict(),
    ]),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.bots.map((bot) => bot.id)).size === value.bots.length,
    'Select each conversation only once.',
  )
export type BulkConversationAction = z.infer<
  typeof bulkConversationSchema
>['action']
export function bulkConversationCommand(
  bot: Pick<WorkspaceBot, 'id' | 'version'>,
  action: BulkConversationAction,
) {
  return action.type === 'section'
    ? {
        path: `bots/${encodeURIComponent(bot.id)}/organization`,
        method: 'PATCH',
        body: { sectionId: action.sectionId, pinned: false },
      }
    : conversationActionRequest({ ...bot, deleted_at: null }, action)
}
export async function applyConversationBulkAction(
  bots: WorkspaceBot[],
  action: BulkConversationAction,
  request: (path: string, body: unknown, method: string) => Promise<unknown>,
) {
  const eligible = bots.filter((bot) => bot.deleted_at === null)
  const failed = bots
    .filter((bot) => bot.deleted_at !== null)
    .map((bot) => ({
      id: bot.id,
      name: bot.name,
      error: 'Restore this conversation first.',
    }))
  if (!eligible.length) return { succeeded: [] as string[], failed }
  const result = (await request(
    'bots/bulk',
    { bots: eligible.map(({ id, version }) => ({ id, version })), action },
    'POST',
  )) as { succeeded: string[]; failed: { id: string; error: string }[] }
  return {
    succeeded: result.succeeded,
    failed: [
      ...failed,
      ...result.failed.map((item) => ({
        ...item,
        name: bots.find((bot) => bot.id === item.id)?.name ?? item.id,
      })),
    ],
  }
}
