import type { UIMessage } from '@tanstack/ai'
import type { AssistantTask } from './assistant-task'
import { delegationSourcesSchema } from './delegation-sources'
import { readMessageAttachments } from './message-attachments'
import {
  readMessageReferences,
  readReferenceSnapshots,
  referenceKey,
  type MessageReference,
} from './message-references'

/** Selected inputs are evidence of selection, never proof of reading or access. */
export function taskContext(
  messages: readonly UIMessage[],
  task?: Pick<
    AssistantTask,
    'messageId' | 'objective' | 'delegationSources' | 'selectedReferences'
  >,
) {
  // A continuation can append user-role messages to the same task. Keep its
  // original request instead of attributing the latest message's inputs to it.
  const message = task
    ? messages.find(
        (item) => item.id === task.messageId && item.role === 'user',
      )
    : [...messages].reverse().find((item) => item.role === 'user')
  const sources = new Map<string, MessageReference>()
  const add = (source: MessageReference) => {
    const key = referenceKey(source)
    if (!sources.has(key)) sources.set(key, source)
  }
  for (const reference of readReferenceSnapshots(task?.selectedReferences))
    add(reference)
  for (const reference of readMessageReferences(message)) add(reference)
  for (const file of readMessageAttachments(message))
    add({
      kind: 'file',
      botId: file.botId,
      conversationId: file.conversationId,
      fileId: file.id,
      label: file.name,
    })
  // These frozen labels survive archiving of the originating message. Older
  // tasks without the snapshot must not borrow another request's sources.
  const frozen = delegationSourcesSchema.safeParse(task?.delegationSources)
  if (frozen.success)
    for (const source of frozen.data)
      add({ ...source.reference, label: source.label })
  return { message, sources: [...sources.values()] }
}
