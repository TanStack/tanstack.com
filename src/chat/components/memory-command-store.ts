import { memoryCommandSchema, type MemoryCommand } from '../core/memory'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export function memoryCommandKey(
  workspaceId: string | undefined,
  userId: string,
  conversationId: string,
) {
  return JSON.stringify([
    'gum',
    'memory-command',
    1,
    workspaceId,
    userId,
    conversationId,
  ])
}
/** Call mutations under the key's Web Lock. Pending text is removed after resolution. */
export class MemoryCommandStore {
  constructor(
    private storage: Storage,
    readonly key: string,
  ) {}
  read(): MemoryCommand | null {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return null
    if (raw.length > 60000) throw Error('The saved memory request is invalid.')
    return memoryCommandSchema.parse(JSON.parse(raw))
  }
  save(command: MemoryCommand) {
    const parsed = memoryCommandSchema.parse(command)
    const existing = this.read()
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(parsed))
        throw Error(
          'Resolve the saved memory request before making another change.',
        )
      return existing
    }
    const text = JSON.stringify(parsed)
    this.storage.setItem(this.key, text)
    if (this.storage.getItem(this.key) !== text)
      throw Error('The memory request could not be saved on this device.')
    return parsed
  }
  clear(commandId: string) {
    if (this.read()?.commandId !== commandId) return
    this.storage.removeItem(this.key)
    if (this.storage.getItem(this.key) !== null)
      throw Error(
        'The resolved memory request could not be cleared on this device.',
      )
  }
}
