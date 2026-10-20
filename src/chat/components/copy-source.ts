import { z } from 'zod'
import {
  conversationLocation,
  type ConversationDestination,
} from '../core/conversation-destination'

export const conversationCopySourceSchema = z.object({
  operationId: z.string().min(1),
  kind: z.enum(['duplicate', 'fork']),
  copiedAt: z.number().int().nonnegative(),
  source: z
    .object({
      botId: z.string().min(1).max(200),
      conversationId: z.string().min(1).max(1000).optional(),
      name: z.string(),
      messageId: z.string().min(1).max(128).nullable(),
      messagePosition: z.literal('before').optional(),
    })
    .optional(),
})

export function retrySourceLocation(
  response: unknown,
  destination: Pick<
    ConversationDestination,
    'workspaceId' | 'botId' | 'conversationId'
  >,
  expectedMessageId?: string,
) {
  const result = conversationCopySourceSchema.safeParse(response)
  const source = result.success ? result.data.source : undefined
  if (
    !result.success ||
    result.data.kind !== 'fork' ||
    !source?.conversationId ||
    !source.messageId ||
    source.messagePosition !== 'before' ||
    (expectedMessageId !== undefined &&
      source.messageId !== expectedMessageId) ||
    (source.botId === destination.botId &&
      source.conversationId === destination.conversationId)
  )
    throw new Error(
      'The original request is no longer available. Your retry draft is kept here.',
    )
  return conversationLocation(
    { ...source, workspaceId: destination.workspaceId },
    {
      view: 'bots',
      q: '',
      sort: 'position',
      group: 'section',
      message: source.messageId,
    },
  )
}

/** A return is a read and explicit navigation only. Save once before the lookup
 * and once afterward, since another input can change while it is in flight.
 */
export async function returnToRetrySource(options: {
  destination: Pick<
    ConversationDestination,
    'workspaceId' | 'botId' | 'conversationId'
  >
  expectedMessageId?: string
  signal: AbortSignal
  saveDraft: () => Promise<boolean>
  readSource: (signal: AbortSignal) => Promise<unknown>
  navigate: (
    location: ReturnType<typeof retrySourceLocation>,
  ) => Promise<unknown>
}) {
  const save = async () => {
    if (options.signal.aborted) return false
    if (!(await options.saveDraft()))
      throw new Error(
        'Save or review your retry draft and resolve any pending send before returning.',
      )
    return !options.signal.aborted
  }
  if (!(await save())) return false
  const source = await options.readSource(options.signal)
  if (options.signal.aborted) return false
  const location = retrySourceLocation(
    source,
    options.destination,
    options.expectedMessageId,
  )
  if (!(await save())) return false
  await options.navigate(location)
  return true
}
