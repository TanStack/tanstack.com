import { workflowStartSchema, type WorkflowStart } from '../core/workflow-start'
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export const workflowStartKey = (
  workspaceId: string | undefined,
  userId: string,
  conversationId: string,
) =>
  JSON.stringify([
    'gum',
    'workflow-start',
    1,
    workspaceId,
    userId,
    conversationId,
  ])
/** Mutations are serialized with the key's Web Lock by the caller. */
export class WorkflowStartStore {
  constructor(
    private storage: Storage,
    readonly key: string,
  ) {}
  read(): WorkflowStart | null {
    const text = this.storage.getItem(this.key)
    if (text === null) return null
    if (text.length > 192 * 1024)
      throw Error('The saved workflow request is invalid.')
    return workflowStartSchema.parse(JSON.parse(text))
  }
  save(input: WorkflowStart) {
    const command = workflowStartSchema.parse(input)
    const prior = this.read()
    if (prior && JSON.stringify(prior) !== JSON.stringify(command))
      throw Error('Resolve the pending workflow start first.')
    const text = JSON.stringify(command)
    this.storage.setItem(this.key, text)
    if (this.storage.getItem(this.key) !== text)
      throw Error('Could not save the workflow request on this device.')
    return command
  }
  clear(id: string) {
    if (this.read()?.commandId !== id) return
    this.storage.removeItem(this.key)
    if (this.storage.getItem(this.key) !== null)
      throw Error('Could not clear the completed workflow request.')
  }
}
