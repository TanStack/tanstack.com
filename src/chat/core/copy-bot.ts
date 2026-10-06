import { z } from 'zod'
import { copyBoundarySchema, type CopyKind } from './conversation-copy'
import type { WorkspaceBot } from './bot-workspace'

export const copyBotRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    kind: z.enum(['duplicate', 'fork']),
    boundary: copyBoundarySchema,
    name: z.string().trim().min(1).max(60),
    parentId: z.string().min(1).nullable(),
  })
  .strict()
  .refine(
    (value) => (value.kind === 'duplicate') === (value.boundary.kind === 'end'),
  )
export type CopyBotRequest = z.infer<typeof copyBotRequestSchema>
export const savedCopyAttemptSchema = z
  .object({
    sourceConversationId: z.string().min(1).max(1000).optional(),
    request: copyBotRequestSchema,
    operationId: z.string().min(1).max(128).optional(),
  })
  .strict()
export type SavedCopyAttempt = z.infer<typeof savedCopyAttemptSchema>

export function copyBotName(name: string, kind: CopyKind) {
  const suffix = kind === 'duplicate' ? ' copy' : ' fork'
  return (
    name
      .slice(0, 60 - suffix.length)
      .replace(/[\uD800-\uDBFF]$/, '')
      .trimEnd() + suffix
  )
}

export function copyBotPlacement(bot: WorkspaceBot, bots: WorkspaceBot[]) {
  const visited = new Set([bot.id])
  let parentId = bot.parent_id
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = bots.find((candidate) => candidate.id === parentId)
    if (!parent) break
    if (parent.deleted_at === null && parent.archived_at === null)
      return {
        siblingParent: parent,
        canBeChild: bot.deleted_at === null && bot.archived_at === null,
      }
    parentId = parent.parent_id
  }
  return {
    siblingParent: null,
    canBeChild: bot.deleted_at === null && bot.archived_at === null,
  }
}

export function copyRequestStorageKey(
  userId: string,
  bot: Pick<WorkspaceBot, 'id' | 'workspace_id'> & {
    mainConversationId?: string
  },
  messageId?: string,
  conversationId?: string,
  side?: 'before',
) {
  const source = conversationId ?? bot.mainConversationId
  if (!source) throw new Error('Resolve the conversation before copying it.')
  if (side)
    return `gum.copy-request:${JSON.stringify([3, userId, bot.workspace_id, bot.id, source, messageId ?? null, side])}`
  return source === bot.mainConversationId
    ? `gum.copy-request:${JSON.stringify([userId, bot.workspace_id, bot.id, messageId ?? null])}`
    : `gum.copy-request:${JSON.stringify([2, userId, bot.workspace_id, bot.id, source, messageId ?? null])}`
}

export function parseSavedCopyRequest(
  value: string | null,
  messageId?: string,
  side?: 'before',
): CopyBotRequest | null {
  if (!value) return null
  try {
    const request = copyBotRequestSchema.parse(JSON.parse(value))
    if (
      messageId === undefined
        ? request.kind !== 'duplicate'
        : request.boundary.kind !== 'message' ||
          request.boundary.messageId !== messageId ||
          request.boundary.side !== side
    )
      return null
    return request
  } catch {
    return null
  }
}

export function parseSavedCopyAttempt(
  value: string | null,
  messageId?: string,
  source?: { conversationId: string; allowLegacy: boolean },
  side?: 'before',
): SavedCopyAttempt | null {
  if (!value) return null
  try {
    const parsed = savedCopyAttemptSchema.parse(JSON.parse(value))
    if (
      source &&
      (parsed.sourceConversationId
        ? parsed.sourceConversationId !== source.conversationId
        : !source.allowLegacy)
    )
      return null
    return parseSavedCopyRequest(
      JSON.stringify(parsed.request),
      messageId,
      side,
    )
      ? parsed
      : null
  } catch {
    if (source && !source.allowLegacy) return null
    const request = parseSavedCopyRequest(value, messageId, side)
    return request ? { request } : null
  }
}
