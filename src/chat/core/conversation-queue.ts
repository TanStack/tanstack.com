import type { MessageReference } from './message-references'
import type { RunModelSelection } from './run-model'
import { z } from 'zod'
import type { MessageAttachment } from './message-attachments'
import type { ScheduledConversationRunOrigin } from './conversation-runs'
const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const id = z.string().min(1).max(128)
export const queuedText = z.string().trim().min(1).max(12000)
export interface QueuedMessage {
  /** Only the host may populate provenance for an admitted schedule occurrence. */
  origin?: ScheduledConversationRunOrigin
  references?: MessageReference[]
  runModel?: RunModelSelection
  id: string
  messageId: string
  text: string
  createdAt: number
  attachments?: MessageAttachment[]
}
export interface ConversationQueue {
  version: number
  paused: boolean
  items: QueuedMessage[]
  error?: string
}
export const emptyQueue = (): ConversationQueue => ({
  version: 0,
  paused: false,
  items: [],
})
export const queueCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('edit'),
      version,
      id,
      text: z.string().trim().max(12000),
    })
    .strict(),
  z.object({ type: z.literal('delete'), version, id }).strict(),
  z
    .object({ type: z.literal('reorder'), version, ids: z.array(id).max(100) })
    .strict(),
  z.object({ type: z.literal('clear'), version }).strict(),
  z.object({ type: z.literal('pause'), version }).strict(),
  z.object({ type: z.literal('resume'), version }).strict(),
  z.object({ type: z.literal('run-next'), version, id }).strict(),
])
export type QueueCommand = z.infer<typeof queueCommandSchema>
export type QueueResult =
  | { ok: true; queue: ConversationQueue }
  | {
      ok: false
      status: 400 | 404 | 409
      error: string
      queue: ConversationQueue
    }
export function changeQueue(
  queue: ConversationQueue,
  command: QueueCommand,
): QueueResult {
  const fail = (status: 400 | 404 | 409, error: string): QueueResult => ({
    ok: false,
    status,
    error,
    queue,
  })
  if (command.version !== queue.version)
    return fail(409, 'The queue changed. Try again.')
  let items = queue.items.slice(),
    paused = queue.paused
  if ('id' in command && !items.some((item) => item.id === command.id))
    return fail(404, 'This queued message is no longer available.')
  switch (command.type) {
    case 'edit':
      if (
        items.find((item) => item.id === command.id)?.origin?.kind ===
        'schedule'
      )
        return fail(
          400,
          'Scheduled messages cannot be edited here. Edit the schedule instead.',
        )
      if (
        !command.text.trim() &&
        !items.find((item) => item.id === command.id)?.attachments?.length
      )
        return fail(400, 'Write a message or attach a file.')
      items = items.map((item) =>
        item.id === command.id ? { ...item, text: command.text } : item,
      )
      break
    case 'delete':
      items = items.filter((item) => item.id !== command.id)
      break
    case 'clear':
      items = []
      break
    case 'pause':
      paused = true
      break
    case 'resume':
      paused = false
      break
    case 'run-next':
      items = [
        items.find((item) => item.id === command.id)!,
        ...items.filter((item) => item.id !== command.id),
      ]
      paused = false
      break
    case 'reorder':
      if (
        command.ids.length !== items.length ||
        new Set(command.ids).size !== items.length ||
        command.ids.some((id) => !items.some((item) => item.id === id))
      )
        return fail(400, 'Include every queued message exactly once.')
      items = command.ids.map((id) => items.find((item) => item.id === id)!)
      break
  }
  return { ok: true, queue: { version: queue.version + 1, paused, items } }
}

export type QueueSnapshot = ConversationQueue
