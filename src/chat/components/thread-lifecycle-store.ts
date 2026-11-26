import { z } from 'zod'
import {
  archiveThreadSchema,
  renameThreadSchema,
} from '../core/conversation-threads'

export type ThreadLifecycleCommand = z.infer<typeof archiveThreadSchema>
export type ThreadRenameCommand = z.infer<typeof renameThreadSchema>
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export const threadLifecycleKey = (
  workspaceId: string | undefined,
  userId: string,
  conversationId: string,
) =>
  JSON.stringify([
    'gum',
    'thread-lifecycle',
    1,
    workspaceId,
    userId,
    conversationId,
  ])

/** Read and mutate under the matching browser Web Lock. */
class PendingThreadCommandStore<T> {
  constructor(
    private storage: Storage,
    readonly key: string,
    private schema: z.ZodType<T>,
  ) {}
  read(): T | null {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return null
    if (raw.length > 1000) throw Error('The saved thread change is invalid.')
    return this.schema.parse(JSON.parse(raw))
  }
  save(command: T) {
    const parsed = this.schema.parse(command)
    const previous = this.read()
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(parsed))
        throw Error('Resolve the saved thread change first.')
      return previous
    }
    const raw = JSON.stringify(parsed)
    this.storage.setItem(this.key, raw)
    if (this.storage.getItem(this.key) !== raw)
      throw Error('The thread change could not be saved on this device.')
    return parsed
  }
  clear(command: T) {
    if (JSON.stringify(this.read()) !== JSON.stringify(command)) return
    this.storage.removeItem(this.key)
    if (this.storage.getItem(this.key) !== null)
      throw Error(
        'The completed thread change could not be cleared on this device.',
      )
  }
}

export class ThreadLifecycleStore extends PendingThreadCommandStore<ThreadLifecycleCommand> {
  constructor(storage: Storage, key: string) {
    super(storage, key, archiveThreadSchema)
  }
}

export const threadRenameKey = (
  workspaceId: string | undefined,
  userId: string,
  conversationId: string,
) =>
  JSON.stringify([
    'gum',
    'thread-rename',
    1,
    workspaceId,
    userId,
    conversationId,
  ])

export class ThreadRenameStore extends PendingThreadCommandStore<ThreadRenameCommand> {
  constructor(storage: Storage, key: string) {
    super(storage, key, renameThreadSchema)
  }
}
